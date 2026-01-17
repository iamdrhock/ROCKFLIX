import { type NextRequest, NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { downloadAndStoreImage } from "@/lib/image-storage"
import { 
  upsertMovie, 
  findOrCreateGenre, 
  findOrCreateActor, 
  findOrCreateCountry,
  upsertMovieGenre,
  upsertMovieActor,
  upsertMovieCountry,
  upsertSeason,
  upsertEpisode,
  fixRelationshipSequences
} from "@/lib/database/contabo-writes"

const OMDB_API_KEY = "ae021154" // Free OMDb API key

export const POST = adminRoute(async ({ request, supabase }) => {
  console.log("[v0] Import endpoint called")

  try {
    const body = await request.json()
    console.log("[v0] Request body:", body)

    const { imdb_id, quality } = body

    console.log("[v0] Import request for IMDB ID:", imdb_id, "Quality:", quality)

    if (!imdb_id) {
      console.log("[v0] Error: IMDB ID is missing")
      return NextResponse.json({ error: "IMDB ID is required" }, { status: 400 })
    }

    // Fetch movie/series details from OMDb
    const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdb_id}&plot=full`
    console.log("[v0] Fetching from OMDb:", omdbUrl)

    const omdbResponse = await fetch(omdbUrl)
    const omdbData = await omdbResponse.json()

    console.log("[v0] OMDb response:", omdbData)

    if (omdbData.Response === "False") {
      console.log("[v0] OMDb error:", omdbData.Error)
      return NextResponse.json({ error: omdbData.Error || "Movie/Series not found" }, { status: 404 })
    }
    // Determine if it's a movie or series
    const type = omdbData.Type === "series" ? "series" : "movie"
    const totalSeasons = type === "series" ? Number.parseInt(omdbData.totalSeasons || "0") : 0

    console.log("[v0] Inserting into database - Type:", type, "Total Seasons:", totalSeasons)

    let posterUrl = null
    let backdropUrl = null

    if (omdbData.Poster && omdbData.Poster !== "N/A") {
      console.log("[v0] Downloading poster from OMDB...")
      posterUrl = await downloadAndStoreImage(omdbData.Poster, `${type}-${imdb_id}-poster`)
      backdropUrl = posterUrl // OMDB doesn't provide separate backdrop, use poster for both
      console.log("[v0] Poster stored at:", posterUrl)
    }

    const countries =
      omdbData.Country && omdbData.Country !== "N/A" ? omdbData.Country.split(",").map((c: string) => c.trim()).filter(Boolean) : []
    
    if (countries.length === 0) {
      console.warn(`[v0] WARNING: No countries found for "${omdbData.Title}" (IMDB ID: ${imdb_id}). OMDB Country field:`, omdbData.Country)
    } else {
      console.log("[v0] Countries extracted:", countries)
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'
    
    // Fix sequences at the start of import to prevent duplicate key errors
    if (useContabo) {
      await fixRelationshipSequences()
    }

    let insertedMovie: { id: number }

    if (useContabo) {
      // Use Contabo functions
      const movieResult = await upsertMovie({
        title: omdbData.Title,
        description: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
        release_date: omdbData.Released !== "N/A" ? omdbData.Released : null,
        rating: omdbData.imdbRating !== "N/A" ? Number.parseFloat(omdbData.imdbRating) : null,
        duration: omdbData.Runtime !== "N/A" ? omdbData.Runtime : null,
        poster_url: posterUrl,
        backdrop_url: backdropUrl,
        trailer_url: null,
        quality: quality || "HD",
        type: type,
        imdb_id: imdb_id,
        total_seasons: totalSeasons,
        views: 0,
        country: countries.length > 0 ? countries.join(", ") : null,
      })
      insertedMovie = movieResult
      console.log("[v0] Inserted movie/series to Contabo:", insertedMovie)
    } else {
      // Use Supabase
      const { data, error: movieError } = await supabase
        .from("movies")
        .upsert(
          {
            title: omdbData.Title,
            description: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
            release_date: omdbData.Released !== "N/A" ? omdbData.Released : null,
            rating: omdbData.imdbRating !== "N/A" ? Number.parseFloat(omdbData.imdbRating) : null,
            duration: omdbData.Runtime !== "N/A" ? omdbData.Runtime : null,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            trailer_url: null,
            quality: quality || "HD",
            type: type,
            imdb_id: imdb_id,
            total_seasons: totalSeasons,
            views: 0,
            country: countries.length > 0 ? countries.join(", ") : null,
          },
          { onConflict: "imdb_id" },
        )
        .select()
        .single()

      if (movieError) {
        console.error("[v0] Error inserting movie:", movieError)
        return NextResponse.json({ error: "Failed to insert movie/series: " + movieError.message }, { status: 500 })
      }

      insertedMovie = data!
      console.log("[v0] Inserted movie/series:", insertedMovie)
    }

    if (countries.length > 0) {
      console.log("[v0] Processing countries:", countries)

      for (const countryName of countries) {
        if (!countryName) continue

        if (useContabo) {
          const countryId = await findOrCreateCountry(countryName)
          if (countryId) {
            await upsertMovieCountry(insertedMovie.id, countryId)
          }
        } else {
          // Check if country exists
          const { data: existingCountry } = await supabase.from("countries").select("id").eq("name", countryName).single()

          let countryId = existingCountry?.id

          // Create country if it doesn't exist
          if (!countryId) {
            const { data: newCountry } = await supabase
              .from("countries")
              .insert({ name: countryName })
              .select("id")
              .single()

            countryId = newCountry?.id
          }

          if (countryId) {
            await supabase.from("movie_countries").upsert(
              {
                movie_id: insertedMovie.id,
                country_id: countryId,
              },
              { onConflict: "movie_id,country_id" },
            )
          }
        }
      }
    }

    // Handle genres
    if (omdbData.Genre && omdbData.Genre !== "N/A") {
      const genres = omdbData.Genre.split(",").map((g: string) => g.trim())
      console.log("[v0] Processing genres:", genres)

      for (const genreName of genres) {
        if (!genreName) continue

        if (useContabo) {
          const genreId = await findOrCreateGenre(genreName)
          if (genreId) {
            await upsertMovieGenre(insertedMovie.id, genreId)
          }
        } else {
          // Check if genre exists
          const { data: existingGenre } = await supabase.from("genres").select("id").eq("name", genreName).single()

          let genreId = existingGenre?.id

          // Create genre if it doesn't exist
          if (!genreId) {
            const { data: newGenre } = await supabase.from("genres").insert({ name: genreName }).select("id").single()

            genreId = newGenre?.id
          }

          if (genreId) {
            await supabase.from("movie_genres").upsert(
              {
                movie_id: insertedMovie.id,
                genre_id: genreId,
              },
              { onConflict: "movie_id,genre_id" },
            )
          }
        }
      }
    }

    // Handle actors
    if (omdbData.Actors && omdbData.Actors !== "N/A") {
      const actors = omdbData.Actors.split(",").map((a: string) => a.trim())
      console.log("[v0] Processing actors:", actors)

      for (const actorName of actors) {
        if (!actorName) continue

        if (useContabo) {
          const actorId = await findOrCreateActor(actorName, null)
          if (actorId) {
            await upsertMovieActor(insertedMovie.id, actorId, null)
          }
        } else {
          // Check if actor exists
          const { data: existingActor } = await supabase.from("actors").select("id").eq("name", actorName).single()

          let actorId = existingActor?.id

          // Create actor if doesn't exist
          if (!actorId) {
            const { data: newActor } = await supabase.from("actors").insert({ name: actorName }).select("id").single()

            actorId = newActor?.id
          }

          if (actorId) {
            await supabase.from("movie_actors").upsert(
              {
                movie_id: insertedMovie.id,
                actor_id: actorId,
              },
              { onConflict: "movie_id,actor_id" },
            )
          }
        }
      }
    }

    // If it's a series, import seasons and episodes
    let seasonsImported = 0
    let episodesImported = 0

    if (type === "series" && totalSeasons > 0) {
      console.log("[v0] Importing", totalSeasons, "seasons for series")

      for (let seasonNum = 1; seasonNum <= totalSeasons; seasonNum++) {
        const seasonUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdb_id}&Season=${seasonNum}`
        console.log("[v0] Fetching season", seasonNum, "from:", seasonUrl)

        const seasonResponse = await fetch(seasonUrl)
        const seasonData = await seasonResponse.json()

        if (seasonData.Response === "False") {
          console.log("[v0] Season", seasonNum, "not found, skipping")
          continue
        }

        const episodeCount = seasonData.Episodes?.length || 0
        console.log("[v0] Season", seasonNum, "data received from OMDB")
        console.log("[v0] Season", seasonNum, "has", episodeCount, "episodes in OMDB response")

        if (episodeCount === 0) {
          console.log("[v0] WARNING: Season", seasonNum, "has no episodes in OMDB - this may indicate incomplete data")
        }

        let insertedSeason: { id: number }

        if (useContabo) {
          try {
            const seasonResult = await upsertSeason(
              insertedMovie.id,
              seasonNum,
              seasonData.Title || `Season ${seasonNum}`,
              episodeCount
            )
            insertedSeason = seasonResult
            seasonsImported++
            console.log("[v0] Inserted season to Contabo:", insertedSeason)
          } catch (seasonError: any) {
            console.error("[v0] Error inserting season:", seasonError)
            continue
          }
        } else {
          const { data, error: seasonError } = await supabase
            .from("seasons")
            .upsert(
              {
                movie_id: insertedMovie.id,
                season_number: seasonNum,
                title: seasonData.Title || `Season ${seasonNum}`,
                episode_count: episodeCount,
              },
              { onConflict: "movie_id,season_number" },
            )
            .select()
            .single()

          if (seasonError) {
            console.error("[v0] Error inserting season:", seasonError)
            continue
          }

          insertedSeason = data!
          seasonsImported++
          console.log("[v0] Inserted season:", insertedSeason)
        }

        // Insert episodes
        if (seasonData.Episodes) {
          console.log("[v0] Inserting", seasonData.Episodes.length, "episodes for season", seasonNum)

          let successCount = 0
          let failCount = 0

          for (const episode of seasonData.Episodes) {
            if (useContabo) {
              try {
                await upsertEpisode(
                  insertedSeason.id,
                  Number.parseInt(episode.Episode),
                  episode.Title,
                  episode.imdbID || null,
                  episode.Released !== "N/A" ? episode.Released : null
                )
                episodesImported++
                successCount++
              } catch (episodeError: any) {
                failCount++
                console.error("[v0] Error inserting episode", episode.Episode, ":", episodeError)
              }
            } else {
              const { error: episodeError } = await supabase.from("episodes").upsert(
                {
                  season_id: insertedSeason.id,
                  episode_number: Number.parseInt(episode.Episode),
                  title: episode.Title,
                  imdb_id: episode.imdbID || null,
                  release_date: episode.Released !== "N/A" ? episode.Released : null,
                },
                { onConflict: "season_id,episode_number" },
              )

              if (!episodeError) {
                episodesImported++
                successCount++
              } else {
                failCount++
                console.error("[v0] Error inserting episode", episode.Episode, ":", episodeError)
              }
            }
          }

          console.log(`[v0] Season ${seasonNum}: ${successCount} episodes imported successfully, ${failCount} failed`)
        }
      }

      console.log("[v0] OMDB Import Summary:")
      console.log("[v0] - Total seasons imported:", seasonsImported)
      console.log("[v0] - Total episodes imported:", episodesImported)
      console.log("[v0] NOTE: If episode count seems low, OMDB may have incomplete data. Try using TMDB instead.")
    }

    console.log("[v0] Import complete:", {
      title: omdbData.Title,
      type,
      seasons: seasonsImported,
      episodes: episodesImported,
    })

    return NextResponse.json({
      success: true,
      title: omdbData.Title,
      type: type,
      seasons_imported: seasonsImported,
      episodes_imported: episodesImported,
    })
  } catch (error) {
    console.error("[v0] Import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
})
