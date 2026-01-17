import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getCached } from "./cache"

export interface Movie {
  id: number
  imdb_id: string
  tmdb_id?: string
  title: string
  description: string
  poster_url: string
  backdrop_url: string
  trailer_url?: string | null
  release_date: string
  runtime: number
  rating: number
  director: string
  country: string
  production: string
  quality: string
  type: "movie" | "series"
  views: number
  total_seasons?: number
  genres?: string
  actors?: Actor[]
  seasons?: Season[]
  tags?: Tag[]
}

export interface Actor {
  id: number
  name: string
  photo_url: string
  character_name?: string
}

export interface Season {
  id: number
  movie_id: number
  season_number: number
  title: string
  episode_count: number
  episodes?: Episode[]
}

export interface Episode {
  id: number
  season_id: number
  episode_number: number
  title: string
  description?: string
  runtime?: number
  release_date?: string
  imdb_id?: string
}

export interface Comment {
  id: number
  movie_id: number
  user_id?: string
  user_name: string
  comment: string
  comment_text?: string
  created_at: string
  profiles?: {
    username: string
    profile_picture_url?: string
  }
}

export interface TrendingGenre {
  id: number
  name: string
  movie_count: number
  sample_movie_poster: string | null
}

export interface TrendingActor {
  id: number
  name: string
  photo_url: string | null
}

export interface Tag {
  id: number
  name: string
  slug: string
}

// Helper function to safely handle Supabase queries with rate limit error handling
async function safeSupabaseQuery<T>(queryFn: () => Promise<{ data: T | null; error: any }>): Promise<T | null> {
  try {
    console.log("[v0] Executing Supabase query...")
    const result = await queryFn()

    // Check if we got a rate limit error
    if (result.error) {
      const errorMessage = typeof result.error === "string" ? result.error : result.error.message || ""
      console.error("[v0] Supabase query error:", errorMessage)

      if (errorMessage.includes("Too Many Requests") || errorMessage.includes("rate limit")) {
        console.error("[v0] Supabase rate limit hit, returning empty result")
        return null
      }
      return null
    }

    console.log(
      "[v0] Supabase query successful, rows:",
      Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
    )
    return result.data
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    console.error("[v0] Supabase query exception:", errorMessage)

    if (errorMessage.includes("Too Many Requests") || errorMessage.includes("rate limit")) {
      console.error("[v0] Supabase rate limit hit (caught exception), returning empty result")
      return null
    }

    // For "Failed to fetch" errors, return null gracefully
    if (errorMessage.includes("Failed to fetch")) {
      console.error("[v0] Network error - Failed to fetch from Supabase. This may be due to network issues or CORS.")
      return null
    }

    return null
  }
}

type SupabaseClientType =
  | Awaited<ReturnType<typeof createClient>>
  | Awaited<ReturnType<typeof createServiceRoleClient>>

async function fetchMoviesQuery(
  client: SupabaseClientType,
  type: "movie" | "series",
  limit: number,
  page: number = 1,
  filters?: { genre?: string | null; country?: string | null; year?: number | null },
) {
  const from = (page - 1) * limit
  const to = from + limit - 1
  
  let query = client
    .from("movies")
    .select(
      `
      *,
      movie_genres(genre_id, genres(name)),
      movie_actors(actor_id, actors(id, name, photo_url))
    `,
      { count: "exact" },
    )
    .eq("type", type)

  // Apply genre filter
  if (filters?.genre) {
    // First get genre ID(s)
    const { data: genreData } = await client
      .from("genres")
      .select("id, name")
      .ilike("name", `%${filters.genre}%`)
    
    if (genreData && genreData.length > 0) {
      const genreIds = genreData.map((g) => g.id)
      query = query.select(
        `
        *,
        movie_genres!inner(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
        { count: "exact" },
      )
      // Note: We can't directly filter nested relations with .in() in Supabase
      // So we'll fetch all movies and filter in application code, or use a subquery
      // For now, we'll use a two-step approach similar to fetchMoviesByGenre
    }
  }

  // Apply country filter
  if (filters?.country) {
    query = query.select(
      `
      *,
      movie_genres(genre_id, genres(name)),
      movie_actors(actor_id, actors(id, name, photo_url)),
      movie_countries!inner(country_id, countries!inner(name))
    `,
      { count: "exact" },
    )
    query = query.eq("movie_countries.countries.name", filters.country)
  }

  // Apply year filter
  if (filters?.year) {
    const yearStart = `${filters.year}-01-01`
    const yearEnd = `${filters.year}-12-31`
    // Try DATE comparison first
    query = query.gte("release_date", yearStart).lte("release_date", yearEnd)
  }

  return query.order("created_at", { ascending: false }).range(from, to)
}

export async function fetchMovies(
  type: "movie" | "series" = "movie",
  limit = 20,
  page = 1,
  filters?: { genre?: string | null; country?: string | null; year?: number | null },
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  // Include filters in cache key
  const cacheKey = `movies:${type}:${limit}:${page}:${filters?.genre || ""}:${filters?.country || ""}:${filters?.year || ""}`
  
  // Use Contabo if USE_CONTABO_DB is set
  const useContabo = process.env.USE_CONTABO_DB === 'true'
  console.log("[v0] fetchMovies - Using Contabo:", useContabo, "Type:", type, "USE_CONTABO_DB env:", process.env.USE_CONTABO_DB)
  
  if (useContabo) {
    const { fetchMoviesFromContabo } = await import('@/lib/database/contabo-queries')
    return getCached(
      cacheKey,
      () => {
        console.log("[v0] fetchMovies - Calling fetchMoviesFromContabo for type:", type)
        return fetchMoviesFromContabo(type, limit, page, filters)
      },
      { ttl: 300 }
    )
  }
  
  return getCached(
    cacheKey,
    async () => {
      try {
        const supabase = await createClient()

        console.log("[v0] Fetching movies from Supabase, type:", type, "limit:", limit, "page:", page, "filters:", filters)

        const from = (page - 1) * limit
        const to = from + limit - 1

        // Build select statement based on filters
        let selectStatement = `
          *,
          movie_actors(actor_id, actors(id, name, photo_url))
        `
        
        if (filters?.genre && filters?.country) {
          // Both genre and country filters
          selectStatement = `
            *,
            movie_genres!inner(genre_id, genres!inner(name)),
            movie_actors(actor_id, actors(id, name, photo_url)),
            movie_countries!inner(country_id, countries!inner(name))
          `
        } else if (filters?.genre) {
          // Only genre filter
          selectStatement = `
            *,
            movie_genres!inner(genre_id, genres!inner(name)),
            movie_actors(actor_id, actors(id, name, photo_url))
          `
        } else if (filters?.country) {
          // Only country filter
          selectStatement = `
            *,
            movie_genres(genre_id, genres(name)),
            movie_actors(actor_id, actors(id, name, photo_url)),
            movie_countries!inner(country_id, countries!inner(name))
          `
        } else {
          // No filters
          selectStatement = `
            *,
            movie_genres(genre_id, genres(name)),
            movie_actors(actor_id, actors(id, name, photo_url))
          `
        }

        // Build query with filters
        let query = supabase
          .from("movies")
          .select(selectStatement, { count: "exact" })
          .eq("type", type)

        // Apply genre filter
        if (filters?.genre) {
          query = query.ilike("movie_genres.genres.name", filters.genre)
        }

        // Apply country filter
        if (filters?.country) {
          query = query.eq("movie_countries.countries.name", filters.country)
        }

        // Apply year filter
        if (filters?.year) {
          const yearStart = `${filters.year}-01-01`
          const yearEnd = `${filters.year}-12-31`
          // Try DATE comparison first
          query = query.gte("release_date", yearStart).lte("release_date", yearEnd)
        }

        // Execute query
        let queryResult = await query.order("created_at", { ascending: false }).range(from, to)

        // If query fails or returns no results, try fallback for year (string pattern)
        if ((queryResult.error || !queryResult.data || queryResult.data.length === 0) && filters?.year) {
          console.log("[v0] DATE comparison failed, trying string pattern for year...")
          
          // Build select statement for fallback
          let fallbackSelect = `
            *,
            movie_actors(actor_id, actors(id, name, photo_url))
          `
          
          if (filters?.genre && filters?.country) {
            fallbackSelect = `
              *,
              movie_genres!inner(genre_id, genres!inner(name)),
              movie_actors(actor_id, actors(id, name, photo_url)),
              movie_countries!inner(country_id, countries!inner(name))
            `
          } else if (filters?.genre) {
            fallbackSelect = `
              *,
              movie_genres!inner(genre_id, genres!inner(name)),
              movie_actors(actor_id, actors(id, name, photo_url))
            `
          } else if (filters?.country) {
            fallbackSelect = `
              *,
              movie_genres(genre_id, genres(name)),
              movie_actors(actor_id, actors(id, name, photo_url)),
              movie_countries!inner(country_id, countries!inner(name))
            `
          } else {
            fallbackSelect = `
              *,
              movie_genres(genre_id, genres(name)),
              movie_actors(actor_id, actors(id, name, photo_url))
            `
          }

          let fallbackQuery = supabase
            .from("movies")
            .select(fallbackSelect, { count: "exact" })
            .eq("type", type)
            .like("release_date", `${filters.year}%`)

          if (filters?.genre) {
            fallbackQuery = fallbackQuery.ilike("movie_genres.genres.name", filters.genre)
          }

          if (filters?.country) {
            fallbackQuery = fallbackQuery.eq("movie_countries.countries.name", filters.country)
          }

          queryResult = await fallbackQuery.order("created_at", { ascending: false }).range(from, to)
        }

        // Try service role client as fallback
        if ((queryResult.error || !queryResult.data || queryResult.data.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            console.warn("[v0] Falling back to service-role client for fetchMovies")
            const serviceClient = createServiceRoleClient()
            
            // Build select statement for service client
            let serviceSelect = `
              *,
              movie_actors(actor_id, actors(id, name, photo_url))
            `
            
            if (filters?.genre && filters?.country) {
              serviceSelect = `
                *,
                movie_genres!inner(genre_id, genres!inner(name)),
                movie_actors(actor_id, actors(id, name, photo_url)),
                movie_countries!inner(country_id, countries!inner(name))
              `
            } else if (filters?.genre) {
              serviceSelect = `
                *,
                movie_genres!inner(genre_id, genres!inner(name)),
                movie_actors(actor_id, actors(id, name, photo_url))
              `
            } else if (filters?.country) {
              serviceSelect = `
                *,
                movie_genres(genre_id, genres(name)),
                movie_actors(actor_id, actors(id, name, photo_url)),
                movie_countries!inner(country_id, countries!inner(name))
              `
            } else {
              serviceSelect = `
                *,
                movie_genres(genre_id, genres(name)),
                movie_actors(actor_id, actors(id, name, photo_url))
              `
            }

            let serviceQuery = serviceClient
              .from("movies")
              .select(serviceSelect, { count: "exact" })
              .eq("type", type)

            if (filters?.genre) {
              serviceQuery = serviceQuery.ilike("movie_genres.genres.name", filters.genre)
            }

            if (filters?.country) {
              serviceQuery = serviceQuery.eq("movie_countries.countries.name", filters.country)
            }

            if (filters?.year) {
              const yearStart = `${filters.year}-01-01`
              const yearEnd = `${filters.year}-12-31`
              serviceQuery = serviceQuery.gte("release_date", yearStart).lte("release_date", yearEnd)
            }

            const serviceResult = await serviceQuery.order("created_at", { ascending: false }).range(from, to)

            if (serviceResult.error) {
              console.error("[v0] Service-role fallback failed:", serviceResult.error)
            } else {
              queryResult = serviceResult
            }
          } catch (fallbackError) {
            console.error("[v0] Unable to run service-role fallback:", fallbackError)
          }
        }

        if (queryResult.error || !queryResult.data) {
          console.error("[v0] Error fetching movies:", queryResult.error)
          return { movies: [], total: 0, totalPages: 0 }
        }

        const total = queryResult.count || 0
        const totalPages = Math.ceil(total / limit)

        console.log(`[v0] Successfully fetched ${queryResult.data?.length || 0} items for type=${type} (page ${page} of ${totalPages}, total: ${total})`)

        // Transform the data to match our Movie interface
        const movies =
          queryResult.data?.map((movie: any) => ({
            ...movie,
            genres:
              movie.movie_genres
                ?.map((mg: any) => mg.genres?.name)
                .filter(Boolean)
                .join(", ") || "",
            actors:
              movie.movie_actors
                ?.map((ma: any) => ({
                  id: ma.actors?.id,
                  name: ma.actors?.name,
                  photo_url: ma.actors?.photo_url,
                }))
                .filter((a: any) => a.id) || [],
          })) || []

        return { movies, total, totalPages }
      } catch (error) {
        console.error("[v0] Error fetching movies:", error)
        return { movies: [], total: 0, totalPages: 0 }
      }
    },
    { ttl: 300 },
  ) // Cache for 5 minutes
}

export async function fetchMovie(id: number): Promise<Movie | null> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchMovieFromContabo } = await import('@/lib/database/contabo-queries')
    console.log(`[v0] fetchMovie - Using Contabo for ID: ${id}, USE_CONTABO_DB: ${process.env.USE_CONTABO_DB}`)
    const result = await getCached(
      `movie:${id}`,
      () => {
        console.log(`[v0] fetchMovie - Cache MISS, fetching from Contabo for ID: ${id}`)
        return fetchMovieFromContabo(id)
      },
      { ttl: 300 }
    )
    console.log(`[v0] fetchMovie - Result for ID ${id}:`, result ? `Found: ${result.title}` : 'NOT FOUND')
    return result
  }

  return getCached(
    `movie:${id}`,
    async () => {
      try {
        const supabase = await createClient()

        console.log("[v0] Fetching movie from Supabase, id:", id)

        const { data, error } = await supabase
          .from("movies")
          .select(`
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url)),
        movie_tags(tag_id, tags(id, name, slug)),
        seasons(
          id,
          season_number,
          title,
          episode_count,
          episodes(
            id,
            episode_number,
            title,
            release_date,
            imdb_id
          )
        )
      `)
          .eq("id", id)
          .single()

        if (error || !data) {
          return null
        }

        console.log("[v0] Successfully fetched movie:", data.title)

        const movie: Movie = {
          ...data,
          genres:
            data.movie_genres
              ?.map((mg: any) => mg.genres?.name)
              .filter(Boolean)
              .join(", ") || "",
          actors:
            data.movie_actors
              ?.map((ma: any) => ({
                id: ma.actors?.id,
                name: ma.actors?.name,
                photo_url: ma.actors?.photo_url,
              }))
              .filter((a: any) => a.id) || [],
          tags:
            data.movie_tags
              ?.map((mt: any) => ({
                id: mt.tags?.id,
                name: mt.tags?.name,
                slug: mt.tags?.slug,
              }))
              .filter((t: any) => t.id) || [],
          seasons:
            data.seasons
              ?.sort((a: any, b: any) => a.season_number - b.season_number)
              .map((season: any) => ({
                ...season,
                episodes: season.episodes?.sort((a: any, b: any) => a.episode_number - b.episode_number) || [],
              })) || [],
        }

        return movie
      } catch (error) {
        console.error("[v0] Error fetching movie:", error)
        return null
      }
    },
    { ttl: 600 },
  ) // Cache for 10 minutes
}

export async function fetchTrendingGenres(limit = 6): Promise<TrendingGenre[]> {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchTrendingGenresFromContabo } = await import('@/lib/database/contabo-queries')
    return getCached(
      `trending-genres:${limit}`,
      async () => {
        return await fetchTrendingGenresFromContabo(limit)
      },
      { ttl: 300 }
    )
  }

  return getCached(
    `trending-genres:${limit}`,
    async () => {
      try {
        const supabase = await createClient()

        const genresData = await safeSupabaseQuery(async () => {
          return await supabase.from("genres").select("id, name").order("name", { ascending: true }).limit(20)
        })

        if (!genresData) {
          return []
        }

        const genresWithCounts = await Promise.all(
          (genresData || []).map(async (genre: any) => {
            try {
              const { count } = await supabase
                .from("movie_genres")
                .select("*", { count: "exact", head: true })
                .eq("genre_id", genre.id)

              const movieCount = count || 0

              let posterUrl = null
              if (movieCount > 0) {
                const posterData = await safeSupabaseQuery(async () => {
                  return await supabase
                    .from("movie_genres")
                    .select("movie_id, movies(poster_url)")
                    .eq("genre_id", genre.id)
                    .limit(1)
                    .single()
                })

                posterUrl = (posterData as any)?.movies?.poster_url || null
              }

              return {
                id: genre.id,
                name: genre.name,
                movie_count: movieCount,
                sample_movie_poster: posterUrl,
              }
            } catch (error) {
              return {
                id: genre.id,
                name: genre.name,
                movie_count: 0,
                sample_movie_poster: null,
              }
            }
          }),
        )

        const topGenres = genresWithCounts
          .filter((g) => g.movie_count > 0)
          .sort((a, b) => b.movie_count - a.movie_count)
          .slice(0, limit)

        return topGenres
      } catch (error) {
        console.error("[v0] Error fetching trending genres:", error)
        return []
      }
    },
    { ttl: 600 },
  ) // Cache for 10 minutes
}

export async function fetchTrendingActors(limit = 6): Promise<TrendingActor[]> {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchTrendingActorsFromContabo } = await import('@/lib/database/contabo-queries')
    return getCached(
      `featured-actors:${limit}:${Date.now()}`, // Add timestamp to cache key to get different results each time
      async () => {
        return await fetchTrendingActorsFromContabo(limit)
      },
      { ttl: 0 } // No cache - get fresh random actors on each request
    )
  }

  return getCached(
    `featured-actors:${limit}:${Date.now()}`, // Add timestamp to cache key to get different results each time
    async () => {
      try {
        const supabase = await createClient()

        console.log("[fetchTrendingActors] Fetching random featured actors from all movies")

        // Get all unique actors from all movies, then randomly select
        const actorsData = await safeSupabaseQuery(async () => {
          const result = await supabase
            .from("actors")
            .select(
              `
              id,
              name,
              photo_url,
              movie_actors!inner(movie_id, movies!inner(id))
            `
            )
            .not("name", "is", null)
            .neq("name", "")
            .limit(1000) // Get a large pool to randomize from

          console.log("[fetchTrendingActors] Query result:", result.data?.length || 0, "actors")
          return result
        })

        if (!actorsData || actorsData.length === 0) {
          console.log("[fetchTrendingActors] No actors found")
          return []
        }

        // Convert to array and shuffle randomly
        const actorsArray = actorsData.map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          photo_url: actor.photo_url || null,
        }))
        
        // Shuffle array using Fisher-Yates algorithm
        for (let i = actorsArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [actorsArray[i], actorsArray[j]] = [actorsArray[j], actorsArray[i]]
        }

        // Return limited number of actors
        const selectedActors = actorsArray.slice(0, limit)

        console.log(`[fetchTrendingActors] Returning ${selectedActors.length} random featured actors`)
        return selectedActors
      } catch (error) {
        console.error("[fetchTrendingActors] Error:", error)
        return []
      }
    },
    { ttl: 0 }, // No cache - get fresh random actors on each request
  )
}

export async function fetchComments(movieId: number): Promise<Comment[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchCommentsFromContabo } = await import('@/lib/database/contabo-queries')
      const comments = await fetchCommentsFromContabo(movieId)
      return comments
        .filter((c: any) => c.moderation_status === 'approved')
        .map((c: any) => {
          const profile = c.profiles || { username: c.user_name || '', profile_picture_url: null }
          return {
            ...c,
            user_name: profile.username || c.user_name || '',
            comment: c.comment_text || c.comment || '',
            comment_text: c.comment_text || c.comment || '',
            profiles: profile,
            // Also add 'user' for compatibility with watch client
            user: {
              name: profile.username || c.user_name || 'User',
              avatar_url: profile.profile_picture_url || null,
            },
          }
        })
    } catch (error) {
      console.error("[v0] Error fetching comments from Contabo:", error)
      return []
    }
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("comments")
      .select(`
        *,
        profiles (
          username,
          profile_picture_url
        )
      `)
      .eq("movie_id", movieId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Supabase error fetching comments:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[v0] Error fetching comments:", error)
    return []
  }
}

export async function fetchTrendingMovies(type: "movie" | "series" = "movie", limit = 20): Promise<Movie[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchTrendingMoviesFromContabo } = await import('@/lib/database/contabo-queries')
    return getCached(
      `trending:${type}:${limit}`,
      () => fetchTrendingMoviesFromContabo(type, limit),
      { ttl: 300 }
    )
  }

  return getCached(
    `trending:${type}:${limit}`,
    async () => {
      try {
        const supabase = await createClient()

        const data = await safeSupabaseQuery(async () => {
          return await supabase
            .from("movies")
            .select(
              `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
            )
            .eq("type", type)
            .order("views", { ascending: false })
            .limit(limit)
        })

        if (!data) {
          return []
        }

        console.log(`[v0] Successfully fetched ${data?.length || 0} trending ${type}s`)

        const movies =
          data?.map((movie: any) => ({
            ...movie,
            genres:
              movie.movie_genres
                ?.map((mg: any) => mg.genres?.name)
                .filter(Boolean)
                .join(", ") || "",
            actors:
              movie.movie_actors
                ?.map((ma: any) => ({
                  id: ma.actors?.id,
                  name: ma.actors?.name,
                  photo_url: ma.actors?.photo_url,
                }))
                .filter((a: any) => a.id) || [],
          })) || []

        return movies
      } catch (error) {
        console.error("[v0] Error fetching trending movies:", error)
        return []
      }
    },
    { ttl: 300 },
  ) // Cache for 5 minutes
}

export async function fetchLatestMovies(type: "movie" | "series" = "movie", limit = 20): Promise<Movie[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchLatestMoviesFromContabo } = await import('@/lib/database/contabo-queries')
    return getCached(
      `latest:${type}:${limit}`,
      () => fetchLatestMoviesFromContabo(type, limit),
      { ttl: 300 }
    )
  }

  return getCached(
    `latest:${type}:${limit}`,
    async () => {
      try {
        const supabase = await createClient()

        const data = await safeSupabaseQuery(async () => {
          return await supabase
            .from("movies")
            .select(
              `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
            )
            .eq("type", type)
            .order("release_date", { ascending: false })
            .limit(limit)
        })

        if (!data) {
          return []
        }

        console.log(`[v0] Successfully fetched ${data?.length || 0} items for type=${type}`)

        const movies =
          data?.map((movie: any) => ({
            ...movie,
            genres:
              movie.movie_genres
                ?.map((mg: any) => mg.genres?.name)
                .filter(Boolean)
                .join(", ") || "",
            actors:
              movie.movie_actors
                ?.map((ma: any) => ({
                  id: ma.actors?.id,
                  name: ma.actors?.name,
                  photo_url: ma.actors?.photo_url,
                }))
                .filter((a: any) => a.id) || [],
          })) || []

        return movies
      } catch (error) {
        console.error("[v0] Error fetching latest movies:", error)
        return []
      }
    },
    { ttl: 300 },
  ) // Cache for 5 minutes
}

export async function fetchMoviesByGenre(
  genre: string,
  limit = 40,
  page = 1,
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchMoviesByGenreFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchMoviesByGenreFromContabo(genre, limit, page)
    } catch (error) {
      console.error("[v0] Error fetching movies by genre from Contabo:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }
  }

  try {
    const supabase = await createClient()

    console.log("[v0] Fetching movies by genre:", genre, "limit:", limit, "page:", page)

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Use inner join pattern like country query - filter directly on nested relation
    // Try exact match first
    const { data, error, count } = await supabase
      .from("movies")
      .select(
        `
        *,
        movie_genres!inner(genre_id, genres!inner(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
        { count: "exact" },
      )
      .eq("movie_genres.genres.name", genre)
      .order("created_at", { ascending: false })
      .range(from, to)

    // If no results with exact match, try case-insensitive match
    if (error || !data || data.length === 0 || (count || 0) === 0) {
      console.log("[v0] No results with exact match, trying case-insensitive...")
      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
        .from("movies")
        .select(
          `
          *,
          movie_genres!inner(genre_id, genres!inner(name)),
          movie_actors(actor_id, actors(id, name, photo_url))
        `,
          { count: "exact" },
        )
        .ilike("movie_genres.genres.name", genre)
        .order("created_at", { ascending: false })
        .range(from, to)

      if (fallbackError) {
        console.error("[v0] Supabase error fetching movies by genre:", fallbackError)
        return { movies: [], total: 0, totalPages: 0 }
      }

      const total = fallbackCount || 0
      const totalPages = Math.ceil(total / limit)

      const movies =
        fallbackData?.map((movie: any) => ({
          ...movie,
          genres:
            movie.movie_genres
              ?.map((mg: any) => mg.genres?.name)
              .filter(Boolean)
              .join(", ") || "",
          actors:
            movie.movie_actors
              ?.map((ma: any) => ({
                id: ma.actors?.id,
                name: ma.actors?.name,
                photo_url: ma.actors?.photo_url,
              }))
              .filter((a: any) => a.id) || [],
        })) || []

      console.log(`[v0] Found ${movies.length} movies for genre: ${genre} (case-insensitive, page ${page} of ${totalPages}, total: ${total})`)
      return { movies, total, totalPages }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    const movies =
      data?.map((movie: any) => ({
        ...movie,
        genres:
          movie.movie_genres
            ?.map((mg: any) => mg.genres?.name)
            .filter(Boolean)
            .join(", ") || "",
        actors:
          movie.movie_actors
            ?.map((ma: any) => ({
              id: ma.actors?.id,
              name: ma.actors?.name,
              photo_url: ma.actors?.photo_url,
            }))
            .filter((a: any) => a.id) || [],
      })) || []

    console.log(`[v0] Found ${movies.length} movies for genre: ${genre} (exact match, page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error) {
    console.error("[v0] Error fetching movies by genre:", error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

export async function fetchMoviesByYear(
  year: number,
  limit = 40,
  page = 1,
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchMoviesByYearFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchMoviesByYearFromContabo(year, limit, page)
    } catch (error) {
      console.error("[v0] Error fetching movies by year from Contabo:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }
  }

  try {
    const supabase = await createClient()

    console.log("[v0] Fetching movies by year:", year, "limit:", limit, "page:", page)

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Try DATE comparison first (if release_date is DATE type)
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const { data, error, count } = await supabase
      .from("movies")
      .select(
        `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
        { count: "exact" },
      )
      .gte("release_date", yearStart)
      .lte("release_date", yearEnd)
      .order("created_at", { ascending: false })
      .range(from, to)

    // If DATE comparison fails or returns no results, try string pattern matching
    if (error || !data || data.length === 0 || (count || 0) === 0) {
      console.log("[v0] DATE comparison failed or no results, trying string pattern matching...")
      const yearPattern = year.toString()
      
      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
        .from("movies")
        .select(
          `
          *,
          movie_genres(genre_id, genres(name)),
          movie_actors(actor_id, actors(id, name, photo_url))
        `,
          { count: "exact" },
        )
        .like("release_date", `${yearPattern}%`)
        .order("created_at", { ascending: false })
        .range(from, to)

      if (fallbackError) {
        console.error("[v0] Supabase error fetching movies by year (fallback):", fallbackError)
        return { movies: [], total: 0, totalPages: 0 }
      }

      const total = fallbackCount || 0
      const totalPages = Math.ceil(total / limit)

      const movies =
        fallbackData?.map((movie: any) => ({
          ...movie,
          genres:
            movie.movie_genres
              ?.map((mg: any) => mg.genres?.name)
              .filter(Boolean)
              .join(", ") || "",
          actors:
            movie.movie_actors
              ?.map((ma: any) => ({
                id: ma.actors?.id,
                name: ma.actors?.name,
                photo_url: ma.actors?.photo_url,
              }))
              .filter((a: any) => a.id) || [],
        })) || []

      console.log(`[v0] Found ${movies.length} movies for year: ${year} (string pattern, page ${page} of ${totalPages}, total: ${total})`)
      return { movies, total, totalPages }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    const movies =
      data?.map((movie: any) => ({
        ...movie,
        genres:
          movie.movie_genres
            ?.map((mg: any) => mg.genres?.name)
            .filter(Boolean)
            .join(", ") || "",
        actors:
          movie.movie_actors
            ?.map((ma: any) => ({
              id: ma.actors?.id,
              name: ma.actors?.name,
              photo_url: ma.actors?.photo_url,
            }))
            .filter((a: any) => a.id) || [],
      })) || []

    console.log(`[v0] Found ${movies.length} movies for year: ${year} (DATE comparison, page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error) {
    console.error("[v0] Error fetching movies by year:", error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

export async function fetchMoviesByCountry(
  country: string,
  limit = 40,
  page = 1,
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchMoviesByCountryFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchMoviesByCountryFromContabo(country, limit, page)
    } catch (error) {
      console.error("[v0] Error fetching movies by country from Contabo:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }
  }

  try {
    const supabase = await createClient()

    console.log("[v0] Fetching movies by country:", country, "limit:", limit, "page:", page)

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: newData, error: newError, count: newCount } = await supabase
      .from("movies")
      .select(
        `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url)),
        movie_countries!inner(country_id, countries!inner(name))
      `,
        { count: "exact" },
      )
      .eq("movie_countries.countries.name", country)
      .order("created_at", { ascending: false })
      .range(from, to)

    console.log("[v0] New structure query result:", { count: newData?.length, error: newError?.message })

    if (!newError && newData && newData.length > 0) {
      const total = newCount || 0
      const totalPages = Math.ceil(total / limit)
      const movies =
        newData?.map((movie: any) => ({
          ...movie,
          genres:
            movie.movie_genres
              ?.map((mg: any) => mg.genres?.name)
              .filter(Boolean)
              .join(", ") || "",
          actors:
            movie.movie_actors
              ?.map((ma: any) => ({
                id: ma.actors?.id,
                name: ma.actors?.name,
                photo_url: ma.actors?.photo_url,
              }))
              .filter((a: any) => a.id) || [],
        })) || []

      console.log(`[v0] Found ${movies.length} movies for country: ${country} (new structure, page ${page} of ${totalPages})`)
      return { movies, total, totalPages }
    }

    console.log("[v0] Trying fallback to old country field structure")
    const { data: oldData, error: oldError, count: oldCount } = await supabase
      .from("movies")
      .select(
        `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
        { count: "exact" },
      )
      .ilike("country", `%${country}%`)
      .order("created_at", { ascending: false })
      .range(from, to)

    console.log("[v0] Old structure query result:", { count: oldData?.length, error: oldError?.message })

    if (oldError) {
      console.error("[v0] Supabase error fetching movies by country (old structure):", oldError)
      return { movies: [], total: 0, totalPages: 0 }
    }

    const total = oldCount || 0
    const totalPages = Math.ceil(total / limit)
    const movies =
      oldData?.map((movie: any) => ({
        ...movie,
        genres:
          movie.movie_genres
            ?.map((mg: any) => mg.genres?.name)
            .filter(Boolean)
            .join(", ") || "",
        actors:
          movie.movie_actors
            ?.map((ma: any) => ({
              id: ma.actors?.id,
              name: ma.actors?.name,
              photo_url: ma.actors?.photo_url,
            }))
            .filter((a: any) => a.id) || [],
      })) || []

    console.log(`[v0] Found ${movies.length} movies for country: ${country} (old structure, page ${page} of ${totalPages})`)
    return { movies, total, totalPages }
  } catch (error) {
    console.error("[v0] Error fetching movies by country:", error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

export async function fetchGenres(): Promise<string[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchGenresFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchGenresFromContabo()
    } catch (error) {
      console.error("[v0] Error fetching genres from Contabo:", error)
      return []
    }
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("genres").select("name").order("name", { ascending: true })

    if (error) {
      console.error("[v0] Supabase error fetching genres:", error)
      return []
    }

    return data?.map((g) => g.name) || []
  } catch (error) {
    console.error("[v0] Error fetching genres:", error)
    return []
  }
}

export async function fetchCountries(type?: "movie" | "series"): Promise<string[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchCountriesFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchCountriesFromContabo(type)
    } catch (error) {
      console.error("[v0] Error fetching countries from Contabo:", error)
      return []
    }
  }

  try {
    const supabase = await createClient()

    let query = supabase
      .from("countries")
      .select("name, movie_countries!inner(movie_id, movies!inner(type))")
      .order("name", { ascending: true })

    if (type) {
      query = query.eq("movie_countries.movies.type", type)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Supabase error fetching countries:", error)
      return []
    }

    // Extract unique country names
    const countriesSet = new Set<string>()
    data?.forEach((item) => {
      if (item.name) {
        countriesSet.add(item.name)
      }
    })

    return Array.from(countriesSet).sort()
  } catch (error) {
    console.error("[v0] Error fetching countries:", error)
    return []
  }
}

export async function fetchYears(type?: "movie" | "series"): Promise<number[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchYearsFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchYearsFromContabo(type)
    } catch (error) {
      console.error("[v0] Error fetching years from Contabo:", error)
      return []
    }
  }

  try {
    const supabase = await createClient()

    let query = supabase.from("movies").select("release_date")

    if (type) {
      query = query.eq("type", type)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Supabase error fetching years:", error)
      return []
    }

    // Extract unique years from release dates
    const yearsSet = new Set<number>()
    data?.forEach((item) => {
      if (item.release_date) {
        const year = new Date(item.release_date).getFullYear()
        if (!isNaN(year) && year > 1900 && year <= new Date().getFullYear() + 2) {
          yearsSet.add(year)
        }
      }
    })

    return Array.from(yearsSet).sort((a, b) => b - a) // Sort descending (newest first)
  } catch (error) {
    console.error("[v0] Error fetching years:", error)
    return []
  }
}

export async function fetchMoviesByActor(
  actorId: number,
  limit = 40,
  page = 1,
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchMoviesByActorFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchMoviesByActorFromContabo(actorId, limit, page)
    } catch (error) {
      console.error("[v0] Error fetching movies by actor from Contabo:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }
  }

  try {
    const supabase = await createClient()

    console.log("[v0] Fetching movies by actor ID:", actorId, "limit:", limit, "page:", page)

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from("movies")
      .select(
        `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors!inner(actor_id, character_name, actors!inner(id, name, photo_url))
      `,
        { count: "exact" },
      )
      .eq("movie_actors.actor_id", actorId)
      .order("release_date", { ascending: false })
      .range(from, to)

    if (error) {
      console.error("[v0] Supabase error fetching movies by actor:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    const movies =
      data?.map((movie: any) => ({
        ...movie,
        genres:
          movie.movie_genres
            ?.map((mg: any) => mg.genres?.name)
            .filter(Boolean)
            .join(", ") || "",
        actors:
          movie.movie_actors
            ?.map((ma: any) => ({
              id: ma.actors?.id,
              name: ma.actors?.name,
              photo_url: ma.actors?.photo_url,
              character_name: ma.character_name,
            }))
            .filter((a: any) => a.id) || [],
      })) || []

    console.log(`[v0] Found ${movies.length} movies for actor ID: ${actorId} (page ${page} of ${totalPages})`)
    return { movies, total, totalPages }
  } catch (error) {
    console.error("[v0] Error fetching movies by actor:", error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

export async function fetchMoviesByTag(
  tagSlug: string,
  limit = 20,
  page = 1,
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchMoviesByTagFromContabo } = await import('@/lib/database/contabo-queries')
      return await fetchMoviesByTagFromContabo(tagSlug, limit, page)
    } catch (error) {
      console.error("[v0] Error fetching movies by tag from Contabo:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }
  }

  try {
    const supabase = await createClient()

    console.log("[v0] Fetching movies by tag slug:", tagSlug, "limit:", limit, "page:", page)

    const from = (page - 1) * limit
    const to = from + limit - 1

    // First, get the tag by slug
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("id, name")
      .eq("slug", tagSlug)
      .single()

    if (tagError || !tag) {
      console.error("[v0] Tag not found:", tagSlug)
      return { movies: [], total: 0, totalPages: 0 }
    }

    // Fetch movie IDs that have this tag
    const { data: movieTagData, error: movieTagError } = await supabase
      .from("movie_tags")
      .select("movie_id")
      .eq("tag_id", tag.id)

    if (movieTagError || !movieTagData || movieTagData.length === 0) {
      console.error("[v0] No movies found with this tag")
      return { movies: [], total: 0, totalPages: 0 }
    }

    // Get unique movie IDs
    const movieIds = [...new Set(movieTagData.map((mt) => mt.movie_id))]
    console.log(`[v0] Found ${movieIds.length} unique movies with tag: ${tagSlug}`)

    // Fetch movies with these IDs
    const { data, error, count } = await supabase
      .from("movies")
      .select(
        `
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `,
        { count: "exact" },
      )
      .in("id", movieIds)
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      console.error("[v0] Supabase error fetching movies by tag:", error)
      return { movies: [], total: 0, totalPages: 0 }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    const movies =
      data?.map((movie: any) => ({
        ...movie,
        genres:
          movie.movie_genres
            ?.map((mg: any) => mg.genres?.name)
            .filter(Boolean)
            .join(", ") || "",
        actors:
          movie.movie_actors
            ?.map((ma: any) => ({
              id: ma.actors?.id,
              name: ma.actors?.name,
              photo_url: ma.actors?.photo_url,
            }))
            .filter((a: any) => a.id) || [],
      })) || []

    console.log(`[v0] Found ${movies.length} movies for tag: ${tagSlug} (page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error) {
    console.error("[v0] Error fetching movies by tag:", error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

export async function fetchActor(actorId: number): Promise<Actor | null> {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchActorFromContabo } = await import('@/lib/database/contabo-queries')
    return await fetchActorFromContabo(actorId)
  }

  try {
    const supabase = await createClient()

    console.log("[v0] Fetching actor details for ID:", actorId)

    const { data, error } = await supabase.from("actors").select("id, name, photo_url").eq("id", actorId).single()

    if (error) {
      console.error("[v0] Supabase error fetching actor:", error)
      return null
    }

    console.log("[v0] Successfully fetched actor:", data?.name)
    return data
  } catch (error) {
    console.error("[v0] Error fetching actor:", error)
    return null
  }
}

export async function fetchAllMoviesForSitemap(): Promise<Array<{ id: number; type: string; updated_at?: string }>> {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchAllMoviesForSitemapFromContabo } = await import('@/lib/database/contabo-queries')
    return await fetchAllMoviesForSitemapFromContabo()
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("movies")
      .select("id, type, updated_at")
      .order("id", { ascending: true })

    if (error) {
      console.error("[v0] Supabase error fetching movies for sitemap:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[v0] Error fetching movies for sitemap:", error)
    return []
  }
}

export async function fetchAllActorsForSitemap(): Promise<Array<{ id: number; updated_at?: string }>> {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    const { fetchAllActorsForSitemapFromContabo } = await import('@/lib/database/contabo-queries')
    return await fetchAllActorsForSitemapFromContabo()
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("actors").select("id, updated_at").order("id", { ascending: true })

    if (error) {
      console.error("[v0] Supabase error fetching actors for sitemap:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[v0] Error fetching actors for sitemap:", error)
    return []
  }
}

export async function fetchSimilarMovies(movieId: number, limit = 5): Promise<Movie[]> {
  // Use Contabo if USE_CONTABO_DB is set
  if (process.env.USE_CONTABO_DB === 'true') {
    return getCached(
      `similar:${movieId}:${limit}`,
      async () => {
        try {
          const { fetchSimilarMoviesFromContabo } = await import('@/lib/database/contabo-queries')
          return await fetchSimilarMoviesFromContabo(movieId, limit)
        } catch (error) {
          console.error("[v0] Error fetching similar movies from Contabo:", error)
          return []
        }
      },
      { ttl: 900 },
    ) // Cache for 15 minutes
  }

  return getCached(
    `similar:${movieId}:${limit}`,
    async () => {
      try {
        const supabase = await createClient()

        const { data: currentMovie, error: movieError } = await supabase
          .from("movies")
          .select(`
        id,
        type,
        movie_genres(genre_id),
        movie_tags(tag_id)
      `)
          .eq("id", movieId)
          .single()

        if (movieError || !currentMovie) {
          return []
        }

        const genreIds = currentMovie.movie_genres?.map((mg: any) => mg.genre_id) || []
        const tagIds = currentMovie.movie_tags?.map((mt: any) => mt.tag_id) || []

        if (genreIds.length === 0 && tagIds.length === 0) {
          return fetchMovies(currentMovie.type, limit)
        }

        const similarMovieIds = new Set<number>()

        const [genreMatches, tagMatches] = await Promise.all([
          genreIds.length > 0
            ? supabase.from("movie_genres").select("movie_id").in("genre_id", genreIds).neq("movie_id", movieId)
            : Promise.resolve({ data: [] }),
          tagIds.length > 0
            ? supabase.from("movie_tags").select("movie_id").in("tag_id", tagIds).neq("movie_id", movieId)
            : Promise.resolve({ data: [] }),
        ])

        genreMatches.data?.forEach((match) => similarMovieIds.add(match.movie_id))
        tagMatches.data?.forEach((match) => similarMovieIds.add(match.movie_id))

        if (similarMovieIds.size === 0) {
          return fetchMovies(currentMovie.type, limit)
        }

        const { data: movies, error } = await supabase
          .from("movies")
          .select(`
        *,
        movie_genres(genre_id, genres(name)),
        movie_actors(actor_id, actors(id, name, photo_url))
      `)
          .in("id", Array.from(similarMovieIds))
          .eq("type", currentMovie.type)
          .order("rating", { ascending: false })
          .limit(limit * 2)

        if (error) {
          return []
        }

        const moviesWithScores =
          movies?.map((movie: any) => {
            const movieGenreIds = movie.movie_genres?.map((mg: any) => mg.genre_id) || []
            const genreMatches = movieGenreIds.filter((id: number) => genreIds.includes(id)).length

            return {
              ...movie,
              similarityScore: genreMatches,
              genres:
                movie.movie_genres
                  ?.map((mg: any) => mg.genres?.name)
                  .filter(Boolean)
                  .join(", ") || "",
              actors:
                movie.movie_actors
                  ?.map((ma: any) => ({
                    id: ma.actors?.id,
                    name: ma.actors?.name,
                    photo_url: ma.actors?.photo_url,
                  }))
                  .filter((a: any) => a.id) || [],
            }
          }) || []

        const sortedMovies = moviesWithScores.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, limit)

        return sortedMovies
      } catch (error) {
        console.error("[v0] Error in fetchSimilarMovies:", error)
        return []
      }
    },
    { ttl: 900 },
  ) // Cache for 15 minutes
}
