import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

import { adminRoute } from "@/lib/security/admin-middleware"

export const POST = adminRoute(async () => {
  try {
    const supabase = createServiceRoleClient()

    const mysqlApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://m4uhdtv.to/api"

    console.log("[v0] Starting migration from MySQL to Supabase")
    console.log("[v0] MySQL API URL:", mysqlApiUrl)

    let totalMovies = 0
    let totalSeries = 0
    let totalGenres = 0
    let totalActors = 0

    // Step 1: Migrate Genres
    console.log("[v0] Fetching genres from MySQL...")
    const genresResponse = await fetch(`${mysqlApiUrl}/genres`)
    const mysqlGenres = await genresResponse.json()

    console.log("[v0] Found", mysqlGenres.length, "genres")

    for (const genre of mysqlGenres) {
      const { error } = await supabase.from("genres").upsert(
        {
          id: genre.id,
          name: genre.name,
          slug: genre.slug,
        },
        { onConflict: "id" },
      )

      if (error) {
        console.error("[v0] Error inserting genre:", genre.name, error)
      } else {
        totalGenres++
      }
    }

    console.log("[v0] Migrated", totalGenres, "genres")

    // Step 2: Migrate Movies
    console.log("[v0] Fetching movies from MySQL...")
    const moviesResponse = await fetch(`${mysqlApiUrl}/movies?type=movie&limit=1000`)
    const mysqlMovies = await moviesResponse.json()

    console.log("[v0] Found", mysqlMovies.length, "movies")

    for (const movie of mysqlMovies) {
      // Insert movie
      const { data: insertedMovie, error: movieError } = await supabase
        .from("movies")
        .upsert(
          {
            id: movie.id,
            imdb_id: movie.imdb_id,
            title: movie.title,
            description: movie.description,
            poster: movie.poster,
            backdrop: movie.backdrop,
            release_date: movie.release_date,
            runtime: movie.runtime,
            rating: movie.rating ? Number.parseFloat(movie.rating) : null,
            director: movie.director,
            country: movie.country,
            production: movie.production,
            quality: movie.quality,
            type: "movie",
            status: movie.status || "active",
            views: movie.views || 0,
            total_seasons: null,
            created_at: movie.created_at,
          },
          { onConflict: "id" },
        )
        .select()
        .single()

      if (movieError) {
        console.error("[v0] Error inserting movie:", movie.title, movieError)
        continue
      }

      totalMovies++

      // Fetch full movie details to get genres and actors
      const movieDetailsResponse = await fetch(`${mysqlApiUrl}/movies/${movie.id}`)
      const movieDetails = await movieDetailsResponse.json()

      // Insert movie genres
      if (movieDetails.genres) {
        let genreNames: string[] = []

        if (typeof movieDetails.genres === "string") {
          genreNames = movieDetails.genres.split(",")
        } else if (Array.isArray(movieDetails.genres)) {
          genreNames = movieDetails.genres
        }

        for (const genreName of genreNames) {
          // Ensure genreName is a string before calling trim()
          const genreNameStr = typeof genreName === "string" ? genreName.trim() : String(genreName || "").trim()

          if (!genreNameStr) continue // Skip empty genre names

          const genre = mysqlGenres.find((g: any) => g.name === genreNameStr)
          if (genre) {
            await supabase.from("movie_genres").upsert(
              {
                movie_id: movie.id,
                genre_id: genre.id,
              },
              { onConflict: "movie_id,genre_id" },
            )
          }
        }
      }

      // Insert actors
      if (movieDetails.actors && Array.isArray(movieDetails.actors)) {
        for (const actor of movieDetails.actors) {
          // Insert actor
          const { error: actorError } = await supabase.from("actors").upsert(
            {
              id: actor.id,
              name: actor.name,
              photo_url: actor.photo,
              bio: actor.bio,
            },
            { onConflict: "id" },
          )

          if (!actorError) {
            // Insert movie_actor relationship
            await supabase.from("movie_actors").upsert(
              {
                movie_id: movie.id,
                actor_id: actor.id,
                character_name: actor.character_name,
              },
              { onConflict: "movie_id,actor_id" },
            )
          }
        }
      }
    }

    console.log("[v0] Migrated", totalMovies, "movies")

    // Step 3: Migrate Series
    console.log("[v0] Fetching series from MySQL...")
    const seriesResponse = await fetch(`${mysqlApiUrl}/movies?type=series&limit=1000`)
    const mysqlSeries = await seriesResponse.json()

    console.log("[v0] Found", mysqlSeries.length, "series")

    for (const series of mysqlSeries) {
      // Insert series
      const { error: seriesError } = await supabase
        .from("movies")
        .upsert(
          {
            id: series.id,
            imdb_id: series.imdb_id,
            title: series.title,
            description: series.description,
            poster: series.poster,
            backdrop: series.backdrop,
            release_date: series.release_date,
            runtime: series.runtime,
            rating: series.rating ? Number.parseFloat(series.rating) : null,
            director: series.director,
            country: series.country,
            production: series.production,
            quality: series.quality,
            type: "series",
            status: series.status || "active",
            views: series.views || 0,
            total_seasons: series.total_seasons,
            created_at: series.created_at,
          },
          { onConflict: "id" },
        )
        .select()
        .single()

      if (seriesError) {
        console.error("[v0] Error inserting series:", series.title, seriesError)
        continue
      }

      totalSeries++

      // Fetch full series details
      const seriesDetailsResponse = await fetch(`${mysqlApiUrl}/movies/${series.id}`)
      const seriesDetails = await seriesDetailsResponse.json()

      // Insert series genres
      if (seriesDetails.genres) {
        let genreNames: string[] = []

        if (typeof seriesDetails.genres === "string") {
          genreNames = seriesDetails.genres.split(",")
        } else if (Array.isArray(seriesDetails.genres)) {
          genreNames = seriesDetails.genres
        }

        for (const genreName of genreNames) {
          // Ensure genreName is a string before calling trim()
          const genreNameStr = typeof genreName === "string" ? genreName.trim() : String(genreName || "").trim()

          if (!genreNameStr) continue // Skip empty genre names

          const genre = mysqlGenres.find((g: any) => g.name === genreNameStr)
          if (genre) {
            await supabase.from("movie_genres").upsert(
              {
                movie_id: series.id,
                genre_id: genre.id,
              },
              { onConflict: "movie_id,genre_id" },
            )
          }
        }
      }

      // Insert actors
      if (seriesDetails.actors && Array.isArray(seriesDetails.actors)) {
        for (const actor of seriesDetails.actors) {
          const { error: actorError } = await supabase.from("actors").upsert(
            {
              id: actor.id,
              name: actor.name,
              photo_url: actor.photo,
              bio: actor.bio,
            },
            { onConflict: "id" },
          )

          if (!actorError) {
            totalActors++
            await supabase.from("movie_actors").upsert(
              {
                movie_id: series.id,
                actor_id: actor.id,
                character_name: actor.character_name,
              },
              { onConflict: "movie_id,actor_id" },
            )
          }
        }
      }

      // Insert seasons and episodes
      if (seriesDetails.episodes && Array.isArray(seriesDetails.episodes)) {
        console.log(`[v0] Processing ${seriesDetails.episodes.length} episodes for series: ${series.title}`)

        // Group episodes by season
        const seasonMap = new Map()

        for (const episode of seriesDetails.episodes) {
          if (!seasonMap.has(episode.season)) {
            seasonMap.set(episode.season, [])
          }
          seasonMap.get(episode.season).push(episode)
        }

        console.log(`[v0] Found ${seasonMap.size} seasons for ${series.title}`)
        for (const [seasonNum, eps] of seasonMap.entries()) {
          console.log(`[v0] Season ${seasonNum}: ${eps.length} episodes`)
        }

        // Insert seasons
        for (const [seasonNumber, episodes] of seasonMap.entries()) {
          const { data: season, error: seasonError } = await supabase
            .from("seasons")
            .upsert(
              {
                movie_id: series.id,
                season_number: seasonNumber,
                title: `Season ${seasonNumber}`,
                episode_count: episodes.length,
              },
              { onConflict: "movie_id,season_number" },
            )
            .select()
            .single()

          if (seasonError) {
            console.error(`[v0] Error inserting season ${seasonNumber} for ${series.title}:`, seasonError)
            continue
          }

          let successfulEpisodes = 0
          let failedEpisodes = 0

          // Insert episodes
          for (const episode of episodes) {
            const { error: episodeError } = await supabase.from("episodes").upsert(
              {
                season_id: season.id,
                episode_number: episode.episode_number,
                title: episode.title,
                release_date: episode.release_date,
                imdb_id: episode.imdb_id,
              },
              { onConflict: "season_id,episode_number" },
            )

            if (episodeError) {
              console.error(
                `[v0] Error inserting episode ${episode.episode_number} of season ${seasonNumber} for ${series.title}:`,
                episodeError,
              )
              failedEpisodes++
            } else {
              successfulEpisodes++
            }
          }

          console.log(
            `[v0] Season ${seasonNumber} of ${series.title}: ${successfulEpisodes} episodes inserted successfully, ${failedEpisodes} failed`,
          )
        }
      }
    }

    console.log("[v0] Migrated", totalSeries, "series")
    console.log("[v0] Migration complete!")

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      stats: {
        genres: totalGenres,
        movies: totalMovies,
        series: totalSeries,
        actors: totalActors,
      },
    })
  } catch (error) {
    console.error("[v0] Migration error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
})
