import { type NextRequest, NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { downloadAndStoreImage, generateImageFilename, getImageExtension, deleteImages } from "@/lib/image-storage"
import {
  findMovieByImdbId,
  upsertMovie,
  findOrCreateCountry,
  upsertMovieCountry,
  findOrCreateGenre,
  upsertMovieGenre,
  findOrCreateActor,
  upsertMovieActor,
  findOrCreateTag,
  upsertMovieTag,
  upsertSeason,
  upsertEpisode,
  deleteMovieRelationships,
  fixRelationshipSequences,
} from "@/lib/database/contabo-writes"

// TMDB API key - users should add this as an environment variable
const TMDB_API_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY"
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

function parseTMDBInput(input: string, contentType?: "movie" | "tv"): { id: string; type: "movie" | "tv" } | null {
  try {
    // Check if it's a full TMDB URL
    const movieUrlMatch = input.match(/themoviedb\.org\/movie\/(\d+)/)
    const tvUrlMatch = input.match(/themoviedb\.org\/tv\/(\d+)/)

    if (movieUrlMatch) {
      return { id: movieUrlMatch[1], type: "movie" }
    }

    if (tvUrlMatch) {
      return { id: tvUrlMatch[1], type: "tv" }
    }

    if (/^\d+$/.test(input.trim())) {
      return { id: input.trim(), type: contentType || "movie" }
    }

    return null
  } catch (error) {
    console.error("[v0] Error parsing TMDB input:", error)
    return null
  }
}

// Helper function to extract YouTube trailer URL from TMDB videos
function extractTrailerUrl(videos: any): string | null {
  if (!videos || !videos.results || !Array.isArray(videos.results)) {
    return null
  }

  // Find the first official trailer on YouTube
  const trailer = videos.results.find(
    (video: any) =>
      video.type === "Trailer" &&
      video.site === "YouTube" &&
      video.official === true
  ) || videos.results.find(
    (video: any) =>
      video.type === "Trailer" &&
      video.site === "YouTube"
  )

  if (trailer && trailer.key) {
    return `https://www.youtube.com/embed/${trailer.key}`
  }

  return null
}

export const POST = adminRoute(async ({ request, supabase }) => {
  console.log("[v0] TMDB Import endpoint called")
  console.log("[v0] CSRF token in cookie:", request.cookies.get("csrf_token")?.value ? "present" : "missing")
  console.log("[v0] CSRF token in header:", request.headers.get("X-CSRF-Token") ? "present" : "missing")

  try {
    const body = await request.json()
    const { tmdb_input, quality, contentType } = body

    console.log("[v0] TMDB Import request for input:", tmdb_input, "Quality:", quality, "Type:", contentType)

    if (!tmdb_input) {
      return NextResponse.json({ error: "TMDB URL or ID is required" }, { status: 400 })
    }

    if (TMDB_API_KEY === "YOUR_TMDB_API_KEY") {
      return NextResponse.json(
        { error: "TMDB API key not configured. Please add TMDB_API_KEY to your environment variables." },
        { status: 500 },
      )
    }

    const parsed = parseTMDBInput(tmdb_input, contentType)

    if (!parsed) {
      return NextResponse.json({ error: "Invalid TMDB URL or ID format" }, { status: 400 })
    }

    const { id: tmdbId, type } = parsed
    console.log("[v0] Parsed TMDB ID:", tmdbId, "Type:", type)

    const useContabo = process.env.USE_CONTABO_DB === 'true'
    console.log("[v0] Using Contabo:", useContabo, "USE_CONTABO_DB env:", process.env.USE_CONTABO_DB)

    // Fix sequences at the start of import to prevent duplicate key errors
    if (useContabo) {
      await fixRelationshipSequences()
    }

    const imdbIdToCheck = `tmdb:${tmdbId}`
    let existingContent: { id: number; title: string; type: string; poster_url: string | null; backdrop_url: string | null } | null = null

    if (useContabo) {
      existingContent = await findMovieByImdbId(imdbIdToCheck)
    } else {
      const result = await supabase
        .from("movies")
        .select("id, title, type, poster_url, backdrop_url")
        .eq("imdb_id", imdbIdToCheck)
        .single()
      existingContent = result.data
    }

    const oldImageUrls: (string | null)[] = []
    if (existingContent) {
      console.log("[v0] Re-importing existing content:", existingContent.title)
      console.log("[v0] Old poster URL:", existingContent.poster_url)
      console.log("[v0] Old backdrop URL:", existingContent.backdrop_url)
      oldImageUrls.push(existingContent.poster_url, existingContent.backdrop_url)
    }

    if (type === "tv") {
      // Get TV series details
      const tvUrl = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids,keywords,videos`
      console.log("[v0] Fetching TV series from TMDB:", tvUrl.replace(TMDB_API_KEY, "***"))

      const tvResponse = await fetch(tvUrl)

      if (!tvResponse.ok) {
        console.error("[v0] TMDB API error:", tvResponse.status, tvResponse.statusText)
        return NextResponse.json({ error: "TV series not found in TMDB" }, { status: 404 })
      }

      const tvData = await tvResponse.json()
      console.log("[v0] TMDB TV data received:", tvData.name, "Seasons:", tvData.number_of_seasons)

      const totalSeasons = tvData.number_of_seasons || 0
      const imdbId = tvData.external_ids?.imdb_id || `tmdb:${tmdbId}`

      // Extract trailer URL
      const trailerUrl = extractTrailerUrl(tvData.videos)
      console.log("[v0] Trailer URL extracted:", trailerUrl || "No trailer found")

      // Extract countries from multiple possible sources
      let countries: string[] = []

      // Try production_countries first
      if (tvData.production_countries && Array.isArray(tvData.production_countries) && tvData.production_countries.length > 0) {
        countries = tvData.production_countries.map((c: any) => c.name || c.iso_3166_1).filter(Boolean)
        console.log("[v0] Countries from production_countries:", countries)
      }

      // Fallback to origin_country if production_countries is empty (common for TV shows)
      if (countries.length === 0 && tvData.origin_country && Array.isArray(tvData.origin_country) && tvData.origin_country.length > 0) {
        // origin_country is usually ISO codes, map them to country names
        const isoToName: Record<string, string> = {
          'US': 'United States',
          'GB': 'United Kingdom',
          'CA': 'Canada',
          'AU': 'Australia',
          'FR': 'France',
          'DE': 'Germany',
          'IT': 'Italy',
          'ES': 'Spain',
          'JP': 'Japan',
          'KR': 'South Korea',
          'CN': 'China',
          'IN': 'India',
          'BR': 'Brazil',
          'MX': 'Mexico',
          'RU': 'Russia',
        }
        countries = tvData.origin_country.filter((c: any) => typeof c === 'string' && c.length > 1).map((c: string) => {
          return isoToName[c.toUpperCase()] || c
        })
        console.log("[v0] Countries from origin_country:", countries)
      }

      // If still no countries, log a warning
      if (countries.length === 0) {
        console.warn(`[v0] WARNING: No countries found for series "${tvData.name}" (TMDB ID: ${tmdbId}). production_countries:`, tvData.production_countries, "origin_country:", tvData.origin_country)
      } else {
        console.log("[v0] Final countries extracted:", countries)
      }

      let posterUrl = null
      let backdropUrl = null

      // ALWAYS download and store poster image, even on reimport
      if (tvData.poster_path) {
        const posterExtension = getImageExtension(tvData.poster_path)
        const posterFilename = generateImageFilename(tmdbId, "poster", posterExtension)
        const posterTmdbUrl = `https://image.tmdb.org/t/p/w500${tvData.poster_path}`
        console.log(`[v0] ⬇️ Downloading poster for series ${tvData.name}: ${posterTmdbUrl} -> ${posterFilename}`)
        try {
          posterUrl = await downloadAndStoreImage(
            posterTmdbUrl,
            posterFilename,
            "posters",
          )
          // Only accept local URLs (starting with /uploads/)
          if (posterUrl && posterUrl.startsWith('/uploads/')) {
            console.log(`[v0] ✅ Poster saved successfully: ${posterUrl}`)
          } else if (posterUrl) {
            console.warn(`[v0] ⚠️ Poster download returned non-local URL: ${posterUrl}`)
            // Use existing local URL if available
            if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Using existing local poster URL: ${existingContent.poster_url}`)
              posterUrl = existingContent.poster_url
            } else {
              posterUrl = null // Don't save TMDB URLs
            }
          } else {
            console.error(`[v0] ❌ Poster download failed completely!`)
            // Use existing local URL if available
            if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Fallback to existing local poster URL: ${existingContent.poster_url}`)
              posterUrl = existingContent.poster_url
            }
          }
        } catch (error) {
          console.error(`[v0] ❌ Exception downloading poster:`, error)
          if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
            console.log(`[v0] 📌 Fallback to existing local poster URL after exception: ${existingContent.poster_url}`)
            posterUrl = existingContent.poster_url
          }
        }
        console.log(`[v0] 📝 Final poster URL for database: ${posterUrl || 'null'}`)
      } else {
        console.warn(`[v0] ⚠️ No poster_path for series: ${tvData.name}`)
        if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
          posterUrl = existingContent.poster_url
          console.log(`[v0] 📌 Using existing poster URL: ${posterUrl}`)
        }
      }

      // ALWAYS download and store backdrop image, even on reimport
      if (tvData.backdrop_path) {
        const backdropExtension = getImageExtension(tvData.backdrop_path)
        const backdropFilename = generateImageFilename(tmdbId, "backdrop", backdropExtension)
        const backdropTmdbUrl = `https://image.tmdb.org/t/p/original${tvData.backdrop_path}`
        console.log(`[v0] ⬇️ Downloading backdrop for series ${tvData.name}: ${backdropTmdbUrl} -> ${backdropFilename}`)
        try {
          backdropUrl = await downloadAndStoreImage(
            backdropTmdbUrl,
            backdropFilename,
            "backdrops",
          )
          // Only accept local URLs (starting with /uploads/)
          if (backdropUrl && backdropUrl.startsWith('/uploads/')) {
            console.log(`[v0] ✅ Backdrop saved successfully: ${backdropUrl}`)
          } else if (backdropUrl) {
            console.warn(`[v0] ⚠️ Backdrop download returned non-local URL: ${backdropUrl}`)
            // Use existing local URL if available
            if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Using existing local backdrop URL: ${existingContent.backdrop_url}`)
              backdropUrl = existingContent.backdrop_url
            } else {
              backdropUrl = null // Don't save TMDB URLs
            }
          } else {
            console.error(`[v0] ❌ Backdrop download failed completely!`)
            // Use existing local URL if available
            if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Fallback to existing local backdrop URL: ${existingContent.backdrop_url}`)
              backdropUrl = existingContent.backdrop_url
            }
          }
        } catch (error) {
          console.error(`[v0] ❌ Exception downloading backdrop:`, error)
          if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
            console.log(`[v0] 📌 Fallback to existing local backdrop URL after exception: ${existingContent.backdrop_url}`)
            backdropUrl = existingContent.backdrop_url
          }
        }
        console.log(`[v0] 📝 Final backdrop URL for database: ${backdropUrl || 'null'}`)
      } else {
        console.warn(`[v0] ⚠️ No backdrop_path for series: ${tvData.name}`)
        if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
          backdropUrl = existingContent.backdrop_url
          console.log(`[v0] 📌 Using existing backdrop URL: ${backdropUrl}`)
        }
      }

      let insertedSeries
      try {
        if (useContabo) {
          const result = await upsertMovie({
            title: tvData.name,
            description: tvData.overview || "",
            release_date: tvData.first_air_date || null,
            rating: tvData.vote_average || null,
            duration: tvData.episode_run_time?.[0] ? `${tvData.episode_run_time[0]} min` : null,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            trailer_url: trailerUrl,
            quality: quality || "HD",
            type: "series",
            imdb_id: imdbId,
            tmdb_id: String(tmdbId),
            total_seasons: totalSeasons,
            views: 0,
            country: countries.length > 0 ? countries.join(", ") : null,
          })
          insertedSeries = { id: result.id }

          // If reimporting, delete old relationships to ensure clean data
          if (existingContent) {
            console.log("[v0] Reimport detected - cleaning up old relationships for series ID:", result.id)
            await deleteMovieRelationships(result.id)
          }
        } else {
          const { data, error: seriesError } = await supabase
            .from("movies")
            .upsert(
              {
                title: tvData.name,
                description: tvData.overview || "",
                release_date: tvData.first_air_date || null,
                rating: tvData.vote_average || null,
                duration: tvData.episode_run_time?.[0] ? `${tvData.episode_run_time[0]} min` : null,
                poster_url: posterUrl,
                backdrop_url: backdropUrl,
                trailer_url: trailerUrl,
                quality: quality || "HD",
                type: "series",
                imdb_id: imdbId,
                tmdb_id: String(tmdbId), // Store TMDB ID for easier lookups
                total_seasons: totalSeasons,
                views: 0,
                country: countries.length > 0 ? countries.join(", ") : null,
              },
              { onConflict: "imdb_id" },
            )
            .select()
            .single()

          if (seriesError) {
            console.error("[v0] Error inserting series:", seriesError)
            return NextResponse.json({ error: "Failed to insert series: " + seriesError.message }, { status: 500 })
          }

          insertedSeries = data
        }
        console.log("[v0] Series inserted with ID:", insertedSeries.id)

        if (oldImageUrls.length > 0) {
          console.log("[v0] Cleaning up old images after re-import")
          await deleteImages(oldImageUrls)
        }
      } catch (error) {
        console.error("[v0] Exception during series insert:", error)
        return NextResponse.json(
          { error: "Database error: " + (error instanceof Error ? error.message : String(error)) },
          { status: 500 },
        )
      }

      if (countries.length > 0) {
        console.log("[v0] Processing", countries.length, "countries")
        for (const countryName of countries) {
          try {
            let countryId: number | null = null
            if (useContabo) {
              countryId = await findOrCreateCountry(countryName)
              if (countryId) {
                await upsertMovieCountry(insertedSeries.id, countryId)
              }
            } else {
              const { data: existingCountry } = await supabase
                .from("countries")
                .select("id")
                .eq("name", countryName)
                .single()

              countryId = existingCountry?.id

              if (!countryId) {
                const { data: newCountry } = await supabase
                  .from("countries")
                  .insert({ name: countryName })
                  .select("id")
                  .single()
                countryId = newCountry?.id
              }

              if (countryId) {
                await supabase
                  .from("movie_countries")
                  .upsert({ movie_id: insertedSeries.id, country_id: countryId }, { onConflict: "movie_id,country_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing country:", countryName, error)
          }
        }
      }

      // Handle genres
      if (tvData.genres && Array.isArray(tvData.genres) && tvData.genres.length > 0) {
        console.log("[v0] Processing", tvData.genres.length, "genres for series ID:", insertedSeries.id)
        for (const genre of tvData.genres) {
          try {
            let genreId: number | null = null
            if (useContabo) {
              try {
                genreId = await findOrCreateGenre(genre.name)
                console.log(`[v0] [Contabo] Genre "${genre.name}" - ID: ${genreId}`)
                if (genreId) {
                  await upsertMovieGenre(insertedSeries.id, genreId)
                  console.log(`[v0] [Contabo] ✅ Linked genre ${genreId} ("${genre.name}") to series ${insertedSeries.id}`)
                } else {
                  console.error(`[v0] [Contabo] ❌ Failed to create/find genre: ${genre.name}`)
                }
              } catch (genreError) {
                console.error(`[v0] [Contabo] ❌ Error processing genre "${genre.name}":`, genreError)
              }
            } else {
              const { data: existingGenre } = await supabase.from("genres").select("id").eq("name", genre.name).single()

              genreId = existingGenre?.id

              if (!genreId) {
                const { data: newGenre } = await supabase
                  .from("genres")
                  .insert({ name: genre.name })
                  .select("id")
                  .single()
                genreId = newGenre?.id
              }

              if (genreId) {
                await supabase
                  .from("movie_genres")
                  .upsert({ movie_id: insertedSeries.id, genre_id: genreId }, { onConflict: "movie_id,genre_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing genre:", genre.name, error)
          }
        }
      }

      // Handle actors (cast)
      if (tvData.credits?.cast && Array.isArray(tvData.credits.cast)) {
        const topCast = tvData.credits.cast.slice(0, 10)
        console.log("[v0] Processing", topCast.length, "cast members")

        for (const castMember of topCast) {
          try {
            let actorPhotoUrl = null
            if (castMember.profile_path) {
              const photoExtension = getImageExtension(castMember.profile_path)
              const photoFilename = generateImageFilename(castMember.id, "actor", photoExtension)
              actorPhotoUrl = await downloadAndStoreImage(
                `https://image.tmdb.org/t/p/w185${castMember.profile_path}`,
                photoFilename,
                "actors",
              )
            }

            let actorId: number | null = null
            if (useContabo) {
              try {
                actorId = await findOrCreateActor(castMember.name, actorPhotoUrl)
                console.log(`[v0] [Contabo] Actor "${castMember.name}" - ID: ${actorId}`)
                if (actorId) {
                  await upsertMovieActor(insertedSeries.id, actorId, castMember.character || null)
                  console.log(`[v0] [Contabo] Linked actor ${actorId} to series ${insertedSeries.id} as "${castMember.character || 'N/A'}"`)
                } else {
                  console.error(`[v0] [Contabo] Failed to create/find actor: ${castMember.name}`)
                }
              } catch (error) {
                console.error(`[v0] [Contabo] Error processing actor "${castMember.name}":`, error)
              }
            } else {
              const { data: existingActor } = await supabase
                .from("actors")
                .select("id, photo_url")
                .eq("name", castMember.name)
                .single()

              actorId = existingActor?.id

              if (actorId) {
                // If actor exists but has no photo, update it with the new photo
                if (existingActor && !existingActor.photo_url && actorPhotoUrl) {
                  console.log("[v0] Updating photo for existing actor:", castMember.name)
                  await supabase.from("actors").update({ photo_url: actorPhotoUrl }).eq("id", actorId)
                }
              } else {
                // Create new actor with photo
                const { data: newActor } = await supabase
                  .from("actors")
                  .insert({
                    name: castMember.name,
                    photo_url: actorPhotoUrl,
                  })
                  .select("id")
                  .single()
                actorId = newActor?.id
              }

              if (actorId) {
                await supabase
                  .from("movie_actors")
                  .upsert({ movie_id: insertedSeries.id, actor_id: actorId }, { onConflict: "movie_id,actor_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing cast member:", castMember.name, error)
          }
        }
      }

      // Handle keywords/tags
      if (tvData.keywords?.results && Array.isArray(tvData.keywords.results) && tvData.keywords.results.length > 0) {
        console.log("[v0] Processing", tvData.keywords.results.length, "keywords (tags)")
        for (const keyword of tvData.keywords.results) {
          try {
            const tagSlug = keyword.name.toLowerCase().replace(/\s+/g, "-")
            let tagId: number | null = null
            if (useContabo) {
              tagId = await findOrCreateTag(keyword.name, tagSlug)
              if (tagId) {
                await upsertMovieTag(insertedSeries.id, tagId)
              }
            } else {
              const { data: existingTag } = await supabase.from("tags").select("id").eq("name", keyword.name).single()

              tagId = existingTag?.id

              if (!tagId) {
                const { data: newTag } = await supabase
                  .from("tags")
                  .insert({ name: keyword.name, slug: tagSlug })
                  .select("id")
                  .single()
                tagId = newTag?.id
              }

              if (tagId) {
                await supabase
                  .from("movie_tags")
                  .upsert({ movie_id: insertedSeries.id, tag_id: tagId }, { onConflict: "movie_id,tag_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing tag:", keyword.name, error)
          }
        }
      }

      // Import seasons and episodes
      let seasonsImported = 0
      let episodesImported = 0

      console.log("[v0] Starting import of", totalSeasons, "seasons for series ID:", insertedSeries.id, "useContabo:", useContabo)

      if (totalSeasons === 0) {
        console.log("[v0] WARNING: totalSeasons is 0 - no seasons to import!")
      }

      for (let seasonNum = 1; seasonNum <= totalSeasons; seasonNum++) {
        try {
          const seasonUrl = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNum}?api_key=${TMDB_API_KEY}`
          console.log("[v0] Fetching season", seasonNum, "of", totalSeasons, "from:", seasonUrl)

          const seasonResponse = await fetch(seasonUrl)

          if (!seasonResponse.ok) {
            console.log("[v0] Season", seasonNum, "not found (status:", seasonResponse.status, "), skipping")
            continue
          }

          const seasonData = await seasonResponse.json()
          const episodeCount = seasonData.episodes?.length || 0

          console.log("[v0] Season", seasonNum, "has", episodeCount, "episodes. Season data:", JSON.stringify(seasonData).substring(0, 200))

          let insertedSeason: { id: number }
          try {
            if (useContabo) {
              console.log("[v0] Using Contabo to insert season", seasonNum, "for series ID:", insertedSeries.id)
              const result = await upsertSeason(
                insertedSeries.id,
                seasonNum,
                seasonData.name || `Season ${seasonNum}`,
                episodeCount
              )
              console.log("[v0] Season inserted with result:", result)
              if (!result || !result.id) {
                throw new Error(`Failed to get season ID from upsertSeason. Result: ${JSON.stringify(result)}`)
              }
              insertedSeason = result
              seasonsImported++
              console.log("[v0] Season", seasonNum, "imported successfully with ID:", insertedSeason.id)
            } else {
              const { data, error: seasonError } = await supabase
                .from("seasons")
                .upsert(
                  {
                    movie_id: insertedSeries.id,
                    season_number: seasonNum,
                    title: seasonData.name || `Season ${seasonNum}`,
                    episode_count: episodeCount,
                  },
                  { onConflict: "movie_id,season_number" },
                )
                .select()
                .single()

              if (seasonError) {
                console.error("[v0] Error inserting season", seasonNum, ":", seasonError)
                continue
              }

              insertedSeason = data
              seasonsImported++
            }

            // Insert episodes
            if (seasonData.episodes && Array.isArray(seasonData.episodes) && seasonData.episodes.length > 0) {
              console.log("[v0] Inserting", seasonData.episodes.length, "episodes for season", seasonNum, "season ID:", insertedSeason.id)

              for (const episode of seasonData.episodes) {
                try {
                  if (useContabo) {
                    console.log("[v0] Inserting episode", episode.episode_number, "for season ID:", insertedSeason.id)
                    await upsertEpisode(
                      insertedSeason.id,
                      episode.episode_number,
                      episode.name || `Episode ${episode.episode_number}`,
                      null,
                      episode.air_date || null
                    )
                    episodesImported++
                    console.log("[v0] Episode", episode.episode_number, "imported successfully")
                  } else {
                    const { error: episodeError } = await supabase.from("episodes").upsert(
                      {
                        season_id: insertedSeason.id,
                        episode_number: episode.episode_number,
                        title: episode.name || `Episode ${episode.episode_number}`,
                        imdb_id: null,
                        release_date: episode.air_date || null,
                      },
                      { onConflict: "season_id,episode_number" },
                    )

                    if (!episodeError) {
                      episodesImported++
                    } else {
                      console.error("[v0] Error inserting episode", episode.episode_number, ":", episodeError.message)
                    }
                  }
                } catch (error) {
                  console.error("[v0] Exception inserting episode", episode.episode_number, ":", error)
                }
              }
            }

            console.log("[v0] Season", seasonNum, "complete:", episodeCount, "episodes processed")
          } catch (error) {
            console.error("[v0] Error processing season", seasonNum, ":", error)
            continue
          }
        } catch (error) {
          console.error("[v0] Error processing season", seasonNum, ":", error)
        }
      }

      console.log("[v0] Import complete! Total:", seasonsImported, "seasons,", episodesImported, "episodes")

      return NextResponse.json({
        success: true,
        title: tvData.name,
        type: "series",
        seasons_imported: seasonsImported,
        episodes_imported: episodesImported,
      })
    } else {
      // Get movie details
      const movieUrl = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords,videos`
      console.log("[v0] Fetching movie from TMDB:", movieUrl.replace(TMDB_API_KEY, "***"))

      const movieResponse = await fetch(movieUrl)

      if (!movieResponse.ok) {
        console.error("[v0] TMDB API error:", movieResponse.status, movieResponse.statusText)
        return NextResponse.json({ error: "Movie not found in TMDB" }, { status: 404 })
      }

      const movieData = await movieResponse.json()
      console.log("[v0] TMDB movie data received:", movieData.title)

      const imdbId = movieData.imdb_id || `tmdb:${tmdbId}`

      // Extract trailer URL
      const trailerUrl = extractTrailerUrl(movieData.videos)
      console.log("[v0] Trailer URL extracted:", trailerUrl || "No trailer found")

      // Extract countries from multiple possible sources
      let countries: string[] = []

      // Try production_countries first (for movies)
      if (movieData.production_countries && Array.isArray(movieData.production_countries) && movieData.production_countries.length > 0) {
        countries = movieData.production_countries.map((c: any) => c.name || c.iso_3166_1).filter(Boolean)
        console.log("[v0] Countries from production_countries:", countries)
      }

      // Fallback to origin_country if production_countries is empty (for TV shows or movies without production_countries)
      if (countries.length === 0 && movieData.origin_country && Array.isArray(movieData.origin_country) && movieData.origin_country.length > 0) {
        // origin_country is usually ISO codes, we'll need to map them to names
        // For now, use them as-is if they look like country names
        countries = movieData.origin_country.filter((c: any) => typeof c === 'string' && c.length > 1).map((c: string) => {
          // Map common ISO codes to country names
          const isoToName: Record<string, string> = {
            'US': 'United States',
            'GB': 'United Kingdom',
            'CA': 'Canada',
            'AU': 'Australia',
            'FR': 'France',
            'DE': 'Germany',
            'IT': 'Italy',
            'ES': 'Spain',
            'JP': 'Japan',
            'KR': 'South Korea',
            'CN': 'China',
            'IN': 'India',
            'BR': 'Brazil',
            'MX': 'Mexico',
            'RU': 'Russia',
          }
          return isoToName[c.toUpperCase()] || c
        })
        console.log("[v0] Countries from origin_country:", countries)
      }

      // If still no countries, log a warning
      if (countries.length === 0) {
        console.warn(`[v0] WARNING: No countries found for movie "${movieData.title}" (TMDB ID: ${tmdbId}). production_countries:`, movieData.production_countries, "origin_country:", movieData.origin_country)
      } else {
        console.log("[v0] Final countries extracted:", countries)
      }

      let posterUrl = null
      let backdropUrl = null

      // ALWAYS download and store poster image, even on reimport
      // This ensures missing images are replaced
      if (movieData.poster_path) {
        const posterExtension = getImageExtension(movieData.poster_path)
        const posterFilename = generateImageFilename(tmdbId, "poster", posterExtension)
        const posterTmdbUrl = `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
        console.log(`[v0] ⬇️ Downloading poster for movie ${movieData.title}: ${posterTmdbUrl} -> ${posterFilename}`)
        try {
          posterUrl = await downloadAndStoreImage(
            posterTmdbUrl,
            posterFilename,
            "posters",
          )
          if (posterUrl && posterUrl.startsWith('/uploads/')) {
            console.log(`[v0] ✅ Poster saved successfully: ${posterUrl}`)
          } else if (posterUrl) {
            console.warn(`[v0] ⚠️ Poster download returned non-local URL: ${posterUrl}`)
            // Try to use existing URL if available, otherwise use TMDB URL as fallback
            if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Using existing local poster URL: ${existingContent.poster_url}`)
              posterUrl = existingContent.poster_url
            }
          } else {
            console.error(`[v0] ❌ Poster download failed completely!`)
            // Use existing URL if available
            if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Fallback to existing local poster URL: ${existingContent.poster_url}`)
              posterUrl = existingContent.poster_url
            }
          }
        } catch (error) {
          console.error(`[v0] ❌ Exception downloading poster:`, error)
          // Use existing URL if available
          if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
            console.log(`[v0] 📌 Fallback to existing local poster URL after exception: ${existingContent.poster_url}`)
            posterUrl = existingContent.poster_url
          }
        }
        console.log(`[v0] 📝 Final poster URL for database: ${posterUrl || 'null'}`)
      } else {
        console.warn(`[v0] ⚠️ No poster_path for movie: ${movieData.title}`)
        // Use existing poster if available
        if (existingContent?.poster_url && existingContent.poster_url.startsWith('/uploads/')) {
          posterUrl = existingContent.poster_url
          console.log(`[v0] 📌 Using existing poster URL: ${posterUrl}`)
        }
      }

      // ALWAYS download and store backdrop image, even on reimport
      if (movieData.backdrop_path) {
        const backdropExtension = getImageExtension(movieData.backdrop_path)
        const backdropFilename = generateImageFilename(tmdbId, "backdrop", backdropExtension)
        const backdropTmdbUrl = `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`
        console.log(`[v0] ⬇️ Downloading backdrop for movie ${movieData.title}: ${backdropTmdbUrl} -> ${backdropFilename}`)
        try {
          backdropUrl = await downloadAndStoreImage(
            backdropTmdbUrl,
            backdropFilename,
            "backdrops",
          )
          if (backdropUrl && backdropUrl.startsWith('/uploads/')) {
            console.log(`[v0] ✅ Backdrop saved successfully: ${backdropUrl}`)
          } else if (backdropUrl) {
            console.warn(`[v0] ⚠️ Backdrop download returned non-local URL: ${backdropUrl}`)
            // Try to use existing URL if available
            if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Using existing local backdrop URL: ${existingContent.backdrop_url}`)
              backdropUrl = existingContent.backdrop_url
            }
          } else {
            console.error(`[v0] ❌ Backdrop download failed completely!`)
            // Use existing URL if available
            if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
              console.log(`[v0] 📌 Fallback to existing local backdrop URL: ${existingContent.backdrop_url}`)
              backdropUrl = existingContent.backdrop_url
            }
          }
        } catch (error) {
          console.error(`[v0] ❌ Exception downloading backdrop:`, error)
          // Use existing URL if available
          if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
            console.log(`[v0] 📌 Fallback to existing local backdrop URL after exception: ${existingContent.backdrop_url}`)
            backdropUrl = existingContent.backdrop_url
          }
        }
        console.log(`[v0] 📝 Final backdrop URL for database: ${backdropUrl || 'null'}`)
      } else {
        console.warn(`[v0] ⚠️ No backdrop_path for movie: ${movieData.title}`)
        // Use existing backdrop if available
        if (existingContent?.backdrop_url && existingContent.backdrop_url.startsWith('/uploads/')) {
          backdropUrl = existingContent.backdrop_url
          console.log(`[v0] 📌 Using existing backdrop URL: ${backdropUrl}`)
        }
      }

      // Insert movie into database
      let insertedMovie
      try {
        if (useContabo) {
          const result = await upsertMovie({
            title: movieData.title,
            description: movieData.overview || "",
            release_date: movieData.release_date || null,
            rating: movieData.vote_average || null,
            duration: movieData.runtime ? `${movieData.runtime} min` : null,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            trailer_url: trailerUrl,
            quality: quality || "HD",
            type: "movie",
            imdb_id: imdbId,
            tmdb_id: String(tmdbId),
            total_seasons: null,
            views: 0,
            country: countries.length > 0 ? countries.join(", ") : null,
          })
          insertedMovie = { id: result.id }

          // If reimporting, delete old relationships to ensure clean data
          if (existingContent) {
            console.log("[v0] Reimport detected - cleaning up old relationships for movie ID:", result.id)
            await deleteMovieRelationships(result.id)
          }
        } else {
          const { data, error: movieError } = await supabase
            .from("movies")
            .upsert(
              {
                title: movieData.title,
                description: movieData.overview || "",
                release_date: movieData.release_date || null,
                rating: movieData.vote_average || null,
                duration: movieData.runtime ? `${movieData.runtime} min` : null,
                poster_url: posterUrl,
                backdrop_url: backdropUrl,
                trailer_url: trailerUrl,
                quality: quality || "HD",
                type: "movie",
                imdb_id: imdbId,
                tmdb_id: String(tmdbId),
                total_seasons: null,
                views: 0,
                country: countries.length > 0 ? countries.join(", ") : null,
              },
              { onConflict: "imdb_id" },
            )
            .select()
            .single()

          if (movieError) {
            console.error("[v0] Error inserting movie:", movieError)
            return NextResponse.json({ error: "Failed to insert movie: " + movieError.message }, { status: 500 })
          }

          insertedMovie = data
        }
        console.log("[v0] Movie inserted with ID:", insertedMovie.id)

        if (oldImageUrls.length > 0) {
          console.log("[v0] Cleaning up old images after re-import")
          await deleteImages(oldImageUrls)
        }
      } catch (error) {
        console.error("[v0] Exception during movie insert:", error)
        return NextResponse.json(
          { error: "Database error: " + (error instanceof Error ? error.message : String(error)) },
          { status: 500 },
        )
      }

      if (countries.length > 0) {
        console.log("[v0] Processing", countries.length, "countries")
        for (const countryName of countries) {
          try {
            let countryId: number | null = null
            if (useContabo) {
              countryId = await findOrCreateCountry(countryName)
              if (countryId) {
                await upsertMovieCountry(insertedMovie.id, countryId)
              }
            } else {
              const { data: existingCountry } = await supabase
                .from("countries")
                .select("id")
                .eq("name", countryName)
                .single()

              countryId = existingCountry?.id

              if (!countryId) {
                const { data: newCountry } = await supabase
                  .from("countries")
                  .insert({ name: countryName })
                  .select("id")
                  .single()
                countryId = newCountry?.id
              }

              if (countryId) {
                await supabase
                  .from("movie_countries")
                  .upsert({ movie_id: insertedMovie.id, country_id: countryId }, { onConflict: "movie_id,country_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing country:", countryName, error)
          }
        }
      }

      // Handle genres
      console.log("[v0] Movie genres check - movieData.genres:", movieData.genres ? (Array.isArray(movieData.genres) ? `${movieData.genres.length} items` : typeof movieData.genres) : 'null/undefined')
      if (movieData.genres && Array.isArray(movieData.genres) && movieData.genres.length > 0) {
        console.log("[v0] ✅ Processing", movieData.genres.length, "genres for movie ID:", insertedMovie.id)
        for (const genre of movieData.genres) {
          try {
            console.log(`[v0] [Contabo] Processing genre: "${genre.name}" (type: ${typeof genre}, name property: ${genre.name})`)
            let genreId: number | null = null
            if (useContabo) {
              try {
                console.log(`[v0] [Contabo] Calling findOrCreateGenre for: "${genre.name}"`)
                genreId = await findOrCreateGenre(genre.name)
                console.log(`[v0] [Contabo] Genre "${genre.name}" - ID: ${genreId}`)
                if (genreId) {
                  await upsertMovieGenre(insertedMovie.id, genreId)
                  console.log(`[v0] [Contabo] ✅ Linked genre ${genreId} ("${genre.name}") to movie ${insertedMovie.id}`)
                } else {
                  console.error(`[v0] [Contabo] ❌ Failed to create/find genre: ${genre.name}`)
                }
              } catch (genreError) {
                console.error(`[v0] [Contabo] ❌ Error processing genre "${genre.name}":`, genreError)
              }
            } else {
              const { data: existingGenre } = await supabase.from("genres").select("id").eq("name", genre.name).single()

              genreId = existingGenre?.id

              if (!genreId) {
                const { data: newGenre } = await supabase
                  .from("genres")
                  .insert({ name: genre.name })
                  .select("id")
                  .single()
                genreId = newGenre?.id
              }

              if (genreId) {
                await supabase
                  .from("movie_genres")
                  .upsert({ movie_id: insertedMovie.id, genre_id: genreId }, { onConflict: "movie_id,genre_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing genre:", genre.name, error)
          }
        }
      } else {
        console.warn(`[v0] ⚠️ WARNING: No genres to process for movie ID ${insertedMovie.id}. movieData.genres:`, movieData.genres)
      }

      // Handle actors (cast)
      if (movieData.credits?.cast && Array.isArray(movieData.credits.cast)) {
        const topCast = movieData.credits.cast.slice(0, 10)
        console.log("[v0] Processing", topCast.length, "cast members")

        for (const castMember of topCast) {
          try {
            let actorPhotoUrl = null
            if (castMember.profile_path) {
              const photoExtension = getImageExtension(castMember.profile_path)
              const photoFilename = generateImageFilename(castMember.id, "actor", photoExtension)
              actorPhotoUrl = await downloadAndStoreImage(
                `https://image.tmdb.org/t/p/w185${castMember.profile_path}`,
                photoFilename,
                "actors",
              )
            }

            let actorId: number | null = null
            if (useContabo) {
              try {
                actorId = await findOrCreateActor(castMember.name, actorPhotoUrl)
                console.log(`[v0] [Contabo] Actor "${castMember.name}" - ID: ${actorId}`)
                if (actorId) {
                  await upsertMovieActor(insertedMovie.id, actorId, castMember.character || null)
                  console.log(`[v0] [Contabo] Linked actor ${actorId} to movie ${insertedMovie.id} as "${castMember.character || 'N/A'}"`)
                } else {
                  console.error(`[v0] [Contabo] Failed to create/find actor: ${castMember.name}`)
                }
              } catch (error) {
                console.error(`[v0] [Contabo] Error processing actor "${castMember.name}":`, error)
              }
            } else {
              const { data: existingActor } = await supabase
                .from("actors")
                .select("id, photo_url")
                .eq("name", castMember.name)
                .single()

              actorId = existingActor?.id

              if (actorId) {
                // If actor exists but has no photo, update it with the new photo
                if (existingActor && !existingActor.photo_url && actorPhotoUrl) {
                  console.log("[v0] Updating photo for existing actor:", castMember.name)
                  await supabase.from("actors").update({ photo_url: actorPhotoUrl }).eq("id", actorId)
                }
              } else {
                // Create new actor with photo
                const { data: newActor } = await supabase
                  .from("actors")
                  .insert({
                    name: castMember.name,
                    photo_url: actorPhotoUrl,
                  })
                  .select("id")
                  .single()
                actorId = newActor?.id
              }

              if (actorId) {
                await supabase
                  .from("movie_actors")
                  .upsert({ movie_id: insertedMovie.id, actor_id: actorId }, { onConflict: "movie_id,actor_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing cast member:", castMember.name, error)
          }
        }
      }

      // Handle keywords/tags
      if (
        movieData.keywords?.keywords &&
        Array.isArray(movieData.keywords.keywords) &&
        movieData.keywords.keywords.length > 0
      ) {
        console.log("[v0] Processing", movieData.keywords.keywords.length, "keywords (tags)")
        for (const keyword of movieData.keywords.keywords) {
          try {
            const tagSlug = keyword.name.toLowerCase().replace(/\s+/g, "-")
            let tagId: number | null = null
            if (useContabo) {
              tagId = await findOrCreateTag(keyword.name, tagSlug)
              if (tagId) {
                await upsertMovieTag(insertedMovie.id, tagId)
              }
            } else {
              const { data: existingTag } = await supabase.from("tags").select("id").eq("name", keyword.name).single()

              tagId = existingTag?.id

              if (!tagId) {
                const { data: newTag } = await supabase
                  .from("tags")
                  .insert({ name: keyword.name, slug: tagSlug })
                  .select("id")
                  .single()
                tagId = newTag?.id
              }

              if (tagId) {
                await supabase
                  .from("movie_tags")
                  .upsert({ movie_id: insertedMovie.id, tag_id: tagId }, { onConflict: "movie_id,tag_id" })
              }
            }
          } catch (error) {
            console.error("[v0] Error processing tag:", keyword.name, error)
          }
        }
      }

      console.log("[v0] Movie import complete!")

      return NextResponse.json({
        success: true,
        title: movieData.title,
        type: "movie",
      })
    }
  } catch (error) {
    console.error("[v0] TMDB Import error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error("[v0] Error stack:", errorStack)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
