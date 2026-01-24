/**
 * Contabo PostgreSQL Direct Queries
 * 
 * Direct SQL queries to Contabo PostgreSQL database
 * Replaces Supabase client queries for data operations
 */

import { queryContabo } from './contabo-pool'

export interface Movie {
  id: number
  title: string
  description?: string
  poster_url?: string
  backdrop_url?: string
  trailer_url?: string
  release_date?: string
  duration?: string
  rating?: number
  quality?: string
  type: 'movie' | 'series'
  country?: string
  imdb_id?: string
  tmdb_id?: string
  total_seasons?: number
  views?: number
  created_at?: string
  updated_at?: string
  genres?: string
  actors?: Array<{ id: number; name: string; photo_url?: string }>
  tags?: Array<{ id: number; name: string; slug: string }>
  seasons?: Array<any>
}

/**
 * Fetch movies/series from Contabo PostgreSQL
 */
export async function fetchMoviesFromContabo(
  type: "movie" | "series" = "movie",
  limit = 20,
  page = 1,
  filters?: { genre?: string | null; country?: string | null; year?: number | null },
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit

    // Build base query
    let sql = `
      SELECT 
        m.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url,
            'character_name', ma.character_name
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres
      FROM movies m
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.type = $1
    `

    const params: any[] = [type]
    let paramIndex = 2

    // Add genre filter
    if (filters?.genre) {
      sql += ` AND EXISTS (
        SELECT 1 FROM movie_genres mg2
        JOIN genres g2 ON mg2.genre_id = g2.id
        WHERE mg2.movie_id = m.id AND g2.name ILIKE $${paramIndex}
      )`
      params.push(`%${filters.genre}%`)
      paramIndex++
    }

    // Add country filter
    if (filters?.country) {
      sql += ` AND EXISTS (
        SELECT 1 FROM movie_countries mc
        JOIN countries c ON mc.country_id = c.id
        WHERE mc.movie_id = m.id AND c.name = $${paramIndex}
      )`
      params.push(filters.country)
      paramIndex++
    }

    // Add year filter
    if (filters?.year) {
      sql += ` AND (m.release_date LIKE $${paramIndex} OR m.release_date::text LIKE $${paramIndex})`
      params.push(`${filters.year}%`)
      paramIndex++
    }

    // Group by and order
    sql += `
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    // Get total count
    let countSql = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      WHERE m.type = $1
    `
    const countParams: any[] = [type]
    let countParamIndex = 2

    if (filters?.genre) {
      countSql += ` AND EXISTS (
        SELECT 1 FROM movie_genres mg2
        JOIN genres g2 ON mg2.genre_id = g2.id
        WHERE mg2.movie_id = m.id AND g2.name ILIKE $${countParamIndex}
      )`
      countParams.push(`%${filters.genre}%`)
      countParamIndex++
    }

    if (filters?.country) {
      countSql += ` AND EXISTS (
        SELECT 1 FROM movie_countries mc
        JOIN countries c ON mc.country_id = c.id
        WHERE mc.movie_id = m.id AND c.name = $${countParamIndex}
      )`
      countParams.push(filters.country)
      countParamIndex++
    }

    if (filters?.year) {
      countSql += ` AND (m.release_date LIKE $${countParamIndex} OR m.release_date::text LIKE $${countParamIndex})`
      countParams.push(`${filters.year}%`)
    }

    // Execute queries
    const [moviesResult, countResult] = await Promise.all([
      queryContabo<Movie & { actors: any; genres: string }>(sql, params),
      queryContabo<{ total: string }>(countSql, countParams),
    ])

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    // Transform results
    const movies: Movie[] = moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))

    console.log(`[Contabo] Fetched ${movies.length} ${type}s (page ${page} of ${totalPages}, total: ${total})`)

    return { movies, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies:`, error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch single movie by ID from Contabo
 */
export async function fetchMovieFromContabo(id: number): Promise<Movie | null> {
  try {
    console.log(`[Contabo] fetchMovieFromContabo called for ID: ${id}`)

    // First, check if movie exists at all (without status column check)
    const checkSql = `SELECT id, title, type FROM movies WHERE id = $1`
    const checkResult = await queryContabo<{ id: number; title: string; type: string }>(checkSql, [id])

    if (checkResult.rows.length === 0) {
      console.error(`[Contabo] Movie ID ${id} does not exist in database`)
      return null
    }

    console.log(`[Contabo] Movie ID ${id} exists: "${checkResult.rows[0].title}", type: ${checkResult.rows[0].type}`)

    // Build main query
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url,
            'character_name', ma.character_name
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'slug', t.slug
          )) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) as tags
      FROM movies m
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      LEFT JOIN movie_tags mt ON m.id = mt.movie_id
      LEFT JOIN tags t ON mt.tag_id = t.id
      WHERE m.id = $1
      GROUP BY m.id
    `

    let result
    try {
      result = await queryContabo<Movie & { actors: any; genres: string; tags: any }>(sql, [id])
    } catch (queryError: any) {
      console.error(`[Contabo] SQL query error for movie ID ${id}:`, queryError)
      console.error(`[Contabo] Error details:`, {
        message: queryError.message,
        code: queryError.code,
        detail: queryError.detail,
        hint: queryError.hint,
        position: queryError.position
      })
      // Try a simpler query without joins to see if the movie exists
      try {
        const simpleResult = await queryContabo<Movie>(`SELECT * FROM movies WHERE id = $1`, [id])
        if (simpleResult.rows.length > 0) {
          console.log(`[Contabo] Movie exists but complex query failed. Movie: ${simpleResult.rows[0].title}`)
          // Return basic movie data
          return {
            ...simpleResult.rows[0],
            actors: [],
            genres: '',
            tags: []
          } as Movie
        }
      } catch (simpleError: any) {
        console.error(`[Contabo] Even simple query failed for movie ID ${id}:`, simpleError)
      }
      return null
    }

    console.log(`[Contabo] fetchMovieFromContabo query result: ${result.rows.length} rows found for ID: ${id}`)

    if (result.rows.length === 0) {
      console.error(`[Contabo] Movie query returned 0 rows for ID: ${id} (but existence check passed)`)
      // This shouldn't happen if the check passed, but return null anyway
      return null
    }

    console.log(`[Contabo] Movie found: ${result.rows[0].title} (ID: ${id})`)

    const row = result.rows[0]

    // Parse actors from JSON if needed
    let actors = row.actors
    if (typeof actors === 'string') {
      try {
        actors = JSON.parse(actors)
      } catch (e) {
        console.error(`[Contabo] Error parsing actors JSON for movie ${id}:`, e)
        actors = []
      }
    }
    if (!Array.isArray(actors)) {
      actors = []
    }
    actors = actors.filter((a: any) => a && a.id)

    // Parse tags from JSON if needed
    let tags = row.tags
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags)
      } catch (e) {
        console.error(`[Contabo] Error parsing tags JSON for movie ${id}:`, e)
        tags = []
      }
    }
    if (!Array.isArray(tags)) {
      tags = []
    }
    tags = tags.filter((t: any) => t && t.id)

    console.log(`[Contabo] Movie ${id} - Genres: "${row.genres}", Actors: ${actors.length}, Tags: ${tags.length}`)
    console.log(`[Contabo] Movie ${id} - Raw genres value:`, typeof row.genres, row.genres)
    console.log(`[Contabo] Movie ${id} - Genres length:`, row.genres ? row.genres.length : 0)
    console.log(`[Contabo] Movie ${id} - Genres empty check:`, !row.genres || row.genres.trim() === '')
    console.log(`[Contabo] Movie ${id} - Raw actors value:`, typeof row.actors, Array.isArray(row.actors) ? `${row.actors.length} items` : row.actors)
    if (Array.isArray(row.actors)) {
      console.log(`[Contabo] Movie ${id} - First 3 actors:`, row.actors.slice(0, 3).map((a: any) => ({ id: a?.id, name: a?.name })))
    }

    // Verify actors in database directly
    const verifyActors = await queryContabo<{ actor_id: number; actor_name: string }>(
      'SELECT ma.actor_id, a.name as actor_name FROM movie_actors ma JOIN actors a ON ma.actor_id = a.id WHERE ma.movie_id = $1 LIMIT 5',
      [id]
    )
    console.log(`[Contabo] Movie ${id} - Direct DB check: Found ${verifyActors.rows.length} actors in movie_actors table`)
    if (verifyActors.rows.length > 0) {
      console.log(`[Contabo] Movie ${id} - Actors in DB:`, verifyActors.rows.map(r => ({ id: r.actor_id, name: r.actor_name })))
    }

    // Verify genres in database directly
    const verifyGenres = await queryContabo<{ genre_id: number; genre_name: string }>(
      'SELECT mg.genre_id, g.name as genre_name FROM movie_genres mg JOIN genres g ON mg.genre_id = g.id WHERE mg.movie_id = $1',
      [id]
    )
    console.log(`[Contabo] Movie ${id} - Direct DB check: Found ${verifyGenres.rows.length} genres in movie_genres table`)
    if (verifyGenres.rows.length > 0) {
      console.log(`[Contabo] Movie ${id} - Genres in DB:`, verifyGenres.rows.map(r => ({ id: r.genre_id, name: r.genre_name })))
      console.log(`[Contabo] Movie ${id} - Genres string should be:`, verifyGenres.rows.map(r => r.genre_name).join(', '))
    } else {
      console.warn(`[Contabo] Movie ${id} - WARNING: No genres found in movie_genres table!`)
    }

    const movie: Movie = {
      ...row,
      actors,
      genres: row.genres || '',
      tags,
    }

    console.log(`[Contabo] Movie ${id} - Final movie object:`, {
      id: movie.id,
      title: movie.title,
      genres: movie.genres,
      actorsCount: movie.actors?.length || 0,
      actors: movie.actors?.slice(0, 3).map(a => ({ id: a.id, name: a.name })) || [],
      tagsCount: movie.tags?.length || 0
    })

    // Fetch seasons if it's a series
    if (movie.type === 'series') {
      console.log(`[Contabo] Fetching seasons and episodes for series ID: ${id}`)
      const seasonsSql = `
        SELECT s.*,
          COALESCE(
            json_agg(
              jsonb_build_object(
                'id', e.id,
                'episode_number', e.episode_number,
                'title', e.title,
                'release_date', e.release_date,
                'imdb_id', e.imdb_id
              ) ORDER BY e.episode_number
            ) FILTER (WHERE e.id IS NOT NULL),
            '[]'::json
          ) as episodes
        FROM seasons s
        LEFT JOIN episodes e ON s.id = e.season_id
        WHERE s.movie_id = $1
        GROUP BY s.id
        ORDER BY s.season_number
      `
      const seasonsResult = await queryContabo<any>(seasonsSql, [id])
      console.log(`[Contabo] Fetched ${seasonsResult.rows.length} seasons for series ID: ${id}`)

      // Transform episodes from JSON string to array if needed
      movie.seasons = seasonsResult.rows.map((season: any) => {
        let episodes = season.episodes
        if (typeof episodes === 'string') {
          try {
            episodes = JSON.parse(episodes)
          } catch (e) {
            console.error(`[Contabo] Error parsing episodes JSON for season ${season.season_number}:`, e)
            episodes = []
          }
        }
        return {
          ...season,
          episodes: Array.isArray(episodes) ? episodes : []
        }
      })

      console.log(`[Contabo] Processed seasons with episodes:`, movie.seasons.map((s: any) => ({
        season_number: s.season_number,
        episodes_count: s.episodes?.length || 0
      })))
    }

    return movie
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movie ${id}:`, error)
    return null
  }
}

/**
 * Fetch trending movies from Contabo
 */
export async function fetchTrendingMoviesFromContabo(
  type: "movie" | "series" = "movie",
  limit = 20
): Promise<Movie[]> {
  try {
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url,
            'character_name', ma.character_name
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres
      FROM movies m
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.type = $1
      GROUP BY m.id
      ORDER BY m.views DESC, m.created_at DESC
      LIMIT $2
    `

    const result = await queryContabo<Movie & { actors: any; genres: string }>(sql, [type, limit])

    return result.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching trending movies:`, error)
    return []
  }
}

/**
 * Search movies from Contabo
 */
export async function searchMoviesFromContabo(
  query: string,
  type?: "movie" | "series",
  page: number = 1,
  limit: number = 20
): Promise<{ movies: Movie[]; total: number }> {
  try {
    // Search with ranking: exact matches first, then starts with, then contains
    // This ensures short titles like "UP", "YOU", "LOW" show up when searched
    const searchPattern = `%${query}%`
    const exactMatch = query.trim()
    const startsWith = `${query}%`
    const offset = (page - 1) * limit

    // Base SQL conditions
    let whereClause = `WHERE title ILIKE $3`
    const params: any[] = [exactMatch, startsWith, searchPattern]

    if (type) {
      whereClause += ` AND type = $${params.length + 1}`
      params.push(type)
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM movies ${whereClause}`
    // We need to use a separate params array for count query because it doesn't need limit/offset
    // but relies on the same base params we've accumulated so far

    // Main query
    let sql = `
      SELECT 
        id, title, type, poster_url, release_date, rating,
        CASE 
          WHEN LOWER(title) = LOWER($1) THEN 1
          WHEN title ILIKE $2 THEN 2
          WHEN title ILIKE $3 THEN 3
          ELSE 4
        END as match_rank
      FROM movies 
      ${whereClause}
      ORDER BY match_rank ASC, LENGTH(title) ASC, created_at DESC NULLS LAST 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    // Execute count query first
    const countResult = await queryContabo<{ total: string }>(countSql, params)
    const total = parseInt(countResult.rows[0]?.total || '0', 10)

    // Execute main query with limit/offset
    params.push(limit, offset)
    const result = await queryContabo<any>(sql, params)

    // Return only the expected fields with safe defaults
    // Ensure proper UTF-8 encoding for titles
    const movies = (result.rows || []).map((row: any) => {
      // Handle encoding issues - ensure title is properly decoded
      let title = row.title || ''
      if (typeof title === 'string') {
        // Remove any invalid UTF-8 sequences
        title = title.replace(/\uFFFD/g, '')
        // Try to fix common encoding issues
        try {
          // If title contains question marks, try to decode it
          if (title.includes('?')) {
            // Check if it's a double-byte encoding issue
            const bytes = Buffer.from(title, 'latin1')
            title = bytes.toString('utf8')
          }
        } catch (e) {
          // If decoding fails, keep original
        }
      }

      return {
        id: Number(row.id) || 0,
        title: title,
        type: (row.type === 'series' ? 'series' : 'movie') as 'movie' | 'series',
        poster_url: row.poster_url || null,
        release_date: row.release_date || null,
        rating: Number(row.rating) || 0
      }
    })

    return { movies, total }
  } catch (error: any) {
    console.error(`[Contabo] Search error:`, error?.message || error)
    return { movies: [], total: 0 }
  }
}

/**
 * Fetch similar movies from Contabo (based on genres and tags)
 */
export async function fetchSimilarMoviesFromContabo(movieId: number, limit = 5): Promise<Movie[]> {
  try {
    // First, get the current movie's genres and tags
    const movieSql = `
      SELECT 
        m.id, m.type,
        COALESCE(json_agg(DISTINCT mg.genre_id) FILTER (WHERE mg.genre_id IS NOT NULL), '[]'::json) as genre_ids,
        COALESCE(json_agg(DISTINCT mt.tag_id) FILTER (WHERE mt.tag_id IS NOT NULL), '[]'::json) as tag_ids
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN movie_tags mt ON m.id = mt.movie_id
      WHERE m.id = $1
      GROUP BY m.id
    `
    const movieResult = await queryContabo<any>(movieSql, [movieId])

    if (movieResult.rows.length === 0) {
      return []
    }

    const currentMovie = movieResult.rows[0]
    const genreIds = Array.isArray(currentMovie.genre_ids) ? currentMovie.genre_ids : []
    const tagIds = Array.isArray(currentMovie.tag_ids) ? currentMovie.tag_ids : []

    if (genreIds.length === 0 && tagIds.length === 0) {
      // Fallback: just return movies of the same type
      const fallbackSql = `
        SELECT 
          m.*,
          COALESCE(
            string_agg(DISTINCT g.name, ', '),
            ''
          ) as genres,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'id', a.id,
              'name', a.name,
              'photo_url', a.photo_url
            )) FILTER (WHERE a.id IS NOT NULL),
            '[]'::json
          ) as actors
        FROM movies m
        LEFT JOIN movie_actors ma ON m.id = ma.movie_id
        LEFT JOIN actors a ON ma.actor_id = a.id
        LEFT JOIN movie_genres mg ON m.id = mg.movie_id
        LEFT JOIN genres g ON mg.genre_id = g.id
        WHERE m.type = $1 AND m.id != $2
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT $3
      `
      const fallbackResult = await queryContabo<Movie & { genres: string; actors: any }>(
        fallbackSql,
        [currentMovie.type, movieId, limit]
      )
      return fallbackResult.rows.map((row: any) => ({
        ...row,
        actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
        genres: row.genres || '',
      }))
    }

    // Find movies with matching genres or tags
    let similarSql = `
      SELECT DISTINCT m.id
      FROM movies m
      WHERE m.type = $1 AND m.id != $2
      AND (
        EXISTS (
          SELECT 1 FROM movie_genres mg
          WHERE mg.movie_id = m.id AND mg.genre_id = ANY($3::int[])
        )
        OR EXISTS (
          SELECT 1 FROM movie_tags mt
          WHERE mt.movie_id = m.id AND mt.tag_id = ANY($4::int[])
        )
      )
      LIMIT $5
    `

    const similarResult = await queryContabo<{ id: number }>(
      similarSql,
      [currentMovie.type, movieId, genreIds, tagIds, limit * 2]
    )

    if (similarResult.rows.length === 0) {
      // Fallback: just return movies of the same type
      const fallbackSql = `
        SELECT 
          m.*,
          COALESCE(
            string_agg(DISTINCT g.name, ', '),
            ''
          ) as genres,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'id', a.id,
              'name', a.name,
              'photo_url', a.photo_url
            )) FILTER (WHERE a.id IS NOT NULL),
            '[]'::json
          ) as actors
        FROM movies m
        LEFT JOIN movie_actors ma ON m.id = ma.movie_id
        LEFT JOIN actors a ON ma.actor_id = a.id
        LEFT JOIN movie_genres mg ON m.id = mg.movie_id
        LEFT JOIN genres g ON mg.genre_id = g.id
        WHERE m.type = $1 AND m.id != $2
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT $3
      `
      const fallbackResult = await queryContabo<Movie & { genres: string; actors: any }>(
        fallbackSql,
        [currentMovie.type, movieId, limit]
      )
      return fallbackResult.rows.map((row: any) => ({
        ...row,
        actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
        genres: row.genres || '',
      }))
    }

    const similarMovieIds = similarResult.rows.map(r => r.id)

    // Fetch full movie details
    const moviesSql = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url,
            'character_name', ma.character_name
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors,
        (
          SELECT COUNT(*) FROM movie_genres mg2
          WHERE mg2.movie_id = m.id AND mg2.genre_id = ANY($2::int[])
        ) as similarity_score
      FROM movies m
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.id = ANY($1::int[])
      GROUP BY m.id
      ORDER BY similarity_score DESC, m.rating DESC NULLS LAST
      LIMIT $3
    `

    const moviesResult = await queryContabo<Movie & { genres: string; actors: any; similarity_score: number }>(
      moviesSql,
      [similarMovieIds, genreIds, limit]
    )

    return moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching similar movies:`, error)
    return []
  }
}

/**
 * Fetch comments from Contabo
 */
export async function fetchCommentsFromContabo(movieId: number): Promise<any[]> {
  try {
    const sql = `
      SELECT 
        c.*,
        COALESCE(p.username, '') as user_name,
        jsonb_build_object(
          'username', p.username,
          'profile_picture_url', p.profile_picture_url
        ) as profiles
      FROM comments c
      LEFT JOIN profiles p ON c.user_id = p.id
      WHERE c.movie_id = $1
      ORDER BY c.created_at DESC
    `

    const result = await queryContabo<any>(sql, [movieId])

    return result.rows.map((row: any) => ({
      ...row,
      user_name: row.user_name || row.profiles?.username || '',
      comment_text: row.comment || row.comment_text || '',
      profiles: row.profiles || null,
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching comments:`, error)
    return []
  }
}

/**
 * Fetch comments for moderation from Contabo
 */
export async function fetchCommentsForModerationFromContabo(
  status: "all" | "flagged" | "pending" | "spam" = "all",
  page: number = 1,
  limit: number = 20
): Promise<{ comments: any[]; total: number; totalPages: number }> {
  try {
    let sql = `
      SELECT 
        c.*,
        jsonb_build_object(
          'username', p.username,
          'email', p.email,
          'profile_picture_url', p.profile_picture_url,
          'reputation_score', p.reputation_score
        ) as profiles
      FROM comments c
      LEFT JOIN profiles p ON c.user_id = p.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // Apply filters
    if (status === "flagged") {
      sql += ` AND c.is_flagged = true`
    } else if (status === "pending") {
      sql += ` AND c.moderation_status = 'pending'`
    } else if (status === "spam") {
      sql += ` AND c.is_spam = true`
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM comments c WHERE 1=1`
    if (status === "flagged") {
      countSql += ` AND c.is_flagged = true`
    } else if (status === "pending") {
      countSql += ` AND c.moderation_status = 'pending'`
    } else if (status === "spam") {
      countSql += ` AND c.is_spam = true`
    }

    // Apply pagination
    const offset = (page - 1) * limit
    sql += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    // Execute queries
    const [commentsResult, countResult] = await Promise.all([
      queryContabo<any>(sql, params),
      queryContabo<{ total: string }>(countSql, []),
    ])

    const comments = commentsResult.rows.map((row: any) => ({
      ...row,
      comment_text: row.comment || row.comment_text || '',
      profiles: row.profiles || null,
    }))
    const total = Number.parseInt(countResult.rows[0]?.total || '0', 10)

    return {
      comments,
      total,
      totalPages: Math.ceil(total / limit),
    }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching comments for moderation:`, error)
    return { comments: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch movies by genre from Contabo
 */
export async function fetchMoviesByGenreFromContabo(
  genre: string,
  limit = 40,
  page = 1
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit

    // Find movies with matching genre
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      INNER JOIN movie_genres mg ON m.id = mg.movie_id
      INNER JOIN genres g ON mg.genre_id = g.id
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      WHERE g.name ILIKE $1
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const countSql = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      INNER JOIN movie_genres mg ON m.id = mg.movie_id
      INNER JOIN genres g ON mg.genre_id = g.id
      WHERE g.name ILIKE $1
    `

    const params = [`%${genre}%`, limit, offset]

    const [moviesResult, countResult] = await Promise.all([
      queryContabo<Movie & { genres: string; actors: any }>(sql, params),
      queryContabo<{ total: string }>(countSql, [`%${genre}%`]),
    ])

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const movies = moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))

    console.log(`[Contabo] Found ${movies.length} movies for genre: ${genre} (page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies by genre:`, error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch movies by year from Contabo
 */
export async function fetchMoviesByYearFromContabo(
  year: number,
  limit = 40,
  page = 1
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit
    const yearPattern = year.toString()

    // Use substring to match year in release_date (which is VARCHAR)
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.release_date IS NOT NULL
        AND m.release_date <> ''
        AND substring(m.release_date from 1 for 4) = $1
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const countSql = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      WHERE m.release_date IS NOT NULL
        AND m.release_date <> ''
        AND substring(m.release_date from 1 for 4) = $1
    `

    const params = [yearPattern, limit, offset]

    const [moviesResult, countResult] = await Promise.all([
      queryContabo<Movie & { genres: string; actors: any }>(sql, params),
      queryContabo<{ total: string }>(countSql, [yearPattern]),
    ])

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const movies = moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))

    console.log(`[Contabo] Found ${movies.length} movies for year: ${year} (page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies by year:`, error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch movies by country from Contabo
 */
export async function fetchMoviesByCountryFromContabo(
  country: string,
  limit = 40,
  page = 1
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  try {
    console.log(`[Contabo] fetchMoviesByCountryFromContabo called: country="${country}", limit=${limit}, page=${page}`)
    const offset = (page - 1) * limit

    // Try multiple matching strategies:
    // 1. Exact match on country name
    // 2. Case-insensitive match
    // 3. Match in movies.country column (comma-separated)
    const sql = `
      SELECT DISTINCT
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', ') OVER (PARTITION BY m.id),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL) OVER (PARTITION BY m.id),
          '[]'::json
        ) as actors
      FROM movies m
      LEFT JOIN movie_countries mc ON m.id = mc.movie_id
      LEFT JOIN countries c ON mc.country_id = c.id
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE 
        (c.name ILIKE $1 OR m.country ILIKE '%' || $1 || '%')
      GROUP BY m.id, g.name, a.id, a.name, a.photo_url
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `

    // Simplified query without window functions for better compatibility
    const sqlFixed = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      LEFT JOIN movie_countries mc ON m.id = mc.movie_id
      LEFT JOIN countries c ON mc.country_id = c.id
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE 
        (c.name ILIKE $1 OR m.country ILIKE '%' || $1 || '%')
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const countSql = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      LEFT JOIN movie_countries mc ON m.id = mc.movie_id
      LEFT JOIN countries c ON mc.country_id = c.id
      WHERE 
        (c.name ILIKE $1 OR m.country ILIKE '%' || $1 || '%')
        AND m.id IS NOT NULL
    `

    // Try multiple search patterns:
    // 1. Exact match (case-insensitive)
    // 2. Contains match (for partial names like "united states" matching "United States of America")
    // 3. Word boundary match (for "united" matching "United States")
    const searchPattern = `%${country}%`
    const exactPattern = country
    const params = [searchPattern, limit, offset]
    const countParams = [searchPattern]

    console.log(`[Contabo] Searching for country: "${country}" (pattern: "${searchPattern}")`)

    // First try exact match, then fall back to pattern match
    const sqlWithExact = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      LEFT JOIN movie_countries mc ON m.id = mc.movie_id
      LEFT JOIN countries c ON mc.country_id = c.id
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE 
        (LOWER(c.name) = LOWER($1) OR c.name ILIKE $2 OR m.country ILIKE $2)
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `

    const countSqlWithExact = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      LEFT JOIN movie_countries mc ON m.id = mc.movie_id
      LEFT JOIN countries c ON mc.country_id = c.id
      WHERE 
        (LOWER(c.name) = LOWER($1) OR c.name ILIKE $2 OR m.country ILIKE $2)
    `

    const exactParams = [exactPattern, searchPattern, limit, offset]
    const exactCountParams = [exactPattern, searchPattern]

    const [moviesResult, countResult] = await Promise.all([
      queryContabo<Movie & { genres: string; actors: any }>(sqlWithExact, exactParams),
      queryContabo<{ total: string }>(countSqlWithExact, exactCountParams),
    ])

    console.log(`[Contabo] Found ${moviesResult.rows.length} movies, total: ${countResult.rows[0]?.total || '0'}`)

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const movies = moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))

    console.log(`[Contabo] Found ${movies.length} movies for country: ${country} (page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies by country:`, error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch movies by tag slug from Contabo
 */
export async function fetchMoviesByTagFromContabo(
  tagSlug: string,
  limit = 20,
  page = 1
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit

    // First, get the tag by slug
    const tagSql = `SELECT id, name FROM tags WHERE slug = $1`
    const tagResult = await queryContabo<{ id: number; name: string }>(tagSql, [tagSlug])

    if (tagResult.rows.length === 0) {
      console.error(`[Contabo] Tag not found: ${tagSlug}`)
      return { movies: [], total: 0, totalPages: 0 }
    }

    const tag = tagResult.rows[0]

    // Find movies with this tag
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      INNER JOIN movie_tags mt ON m.id = mt.movie_id
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE mt.tag_id = $1
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const countSql = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      INNER JOIN movie_tags mt ON m.id = mt.movie_id
      WHERE mt.tag_id = $1
    `

    const params = [tag.id, limit, offset]

    const [moviesResult, countResult] = await Promise.all([
      queryContabo<Movie & { genres: string; actors: any }>(sql, params),
      queryContabo<{ total: string }>(countSql, [tag.id]),
    ])

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const movies = moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))

    console.log(`[Contabo] Found ${movies.length} movies for tag: ${tagSlug} (page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies by tag:`, error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch tag details from Contabo by slug
 */
export async function fetchTagFromContabo(slug: string): Promise<{ id: number; name: string; slug: string } | null> {
  try {
    const tagSql = `SELECT id, name, slug FROM tags WHERE slug = $1`
    const tagResult = await queryContabo<{ id: number; name: string; slug: string }>(tagSql, [slug])

    if (tagResult.rows.length === 0) {
      return null
    }

    return tagResult.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching tag from Contabo:`, error)
    return null
  }
}

/**
 * Fetch movies by actor ID from Contabo
 */
export async function fetchMoviesByActorFromContabo(
  actorId: number,
  limit = 40,
  page = 1
): Promise<{ movies: Movie[]; total: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit

    // Find movies with this actor
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      INNER JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE ma.actor_id = $1
      GROUP BY m.id
      ORDER BY m.release_date DESC NULLS LAST, m.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const countSql = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      INNER JOIN movie_actors ma ON m.id = ma.movie_id
      WHERE ma.actor_id = $1
    `

    const params = [actorId, limit, offset]

    const [moviesResult, countResult] = await Promise.all([
      queryContabo<Movie & { genres: string; actors: any }>(sql, params),
      queryContabo<{ total: string }>(countSql, [actorId]),
    ])

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    const movies = moviesResult.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))

    console.log(`[Contabo] Found ${movies.length} movies for actor ID: ${actorId} (page ${page} of ${totalPages}, total: ${total})`)
    return { movies, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies by actor:`, error)
    return { movies: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch trending genres from Contabo
 */
export async function fetchTrendingGenresFromContabo(limit = 6): Promise<any[]> {
  try {
    // Get all genres with movie counts
    const sql = `
          SELECT 
            g.id,
            g.name,
            COUNT(DISTINCT mg.movie_id) as movie_count,
            (
              SELECT m.poster_url
              FROM movie_genres mg2
              INNER JOIN movies m ON mg2.movie_id = m.id
              WHERE mg2.genre_id = g.id
                AND m.poster_url IS NOT NULL
                AND m.poster_url <> ''
              LIMIT 1
            ) as sample_movie_poster
          FROM genres g
          LEFT JOIN movie_genres mg ON g.id = mg.genre_id
          GROUP BY g.id, g.name
          HAVING COUNT(DISTINCT mg.movie_id) > 0
          ORDER BY movie_count DESC, g.name ASC
          LIMIT $1
        `

    const result = await queryContabo<any>(sql, [limit])

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      movie_count: parseInt(row.movie_count || '0', 10),
      sample_movie_poster: row.sample_movie_poster || null,
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching trending genres:`, error)
    return []
  }
}

/**
 * Fetch featured actors from Contabo
 * Gets random actors from all movies/series in the database
 */
export async function fetchTrendingActorsFromContabo(limit = 6): Promise<any[]> {
  try {
    console.log(`[Contabo] Fetching random featured actors from all movies`)

    // Get random actors from all movies in the database
    // Use a subquery to avoid DISTINCT + RANDOM() issues
    const actorsSql = `
          SELECT 
            a.id,
            a.name,
            a.photo_url
          FROM (
            SELECT DISTINCT a.id, a.name, a.photo_url
            FROM actors a
            INNER JOIN movie_actors ma ON a.id = ma.actor_id
            INNER JOIN movies m ON ma.movie_id = m.id
            WHERE a.name IS NOT NULL
              AND a.name <> ''
          ) a
          ORDER BY RANDOM()
          LIMIT $1
        `

    const result = await queryContabo<any>(actorsSql, [limit])

    console.log(`[Contabo] Found ${result.rows.length} random featured actors`)

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      photo_url: row.photo_url || null,
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching featured actors:`, error)
    return []
  }
}

/**
 * Fetch actor details from Contabo
 */
export async function fetchActorFromContabo(actorId: number): Promise<any | null> {
  try {
    const sql = `
          SELECT id, name, photo_url
          FROM actors
          WHERE id = $1
        `

    const result = await queryContabo<{ id: number; name: string; photo_url?: string }>(sql, [actorId])

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching actor:`, error)
    return null
  }
}

/**
 * Fetch all movies for sitemap from Contabo
 */
export async function fetchAllMoviesForSitemapFromContabo(): Promise<Array<{ id: number; type: string; updated_at?: string }>> {
  try {
    const sql = `
          SELECT id, type, updated_at
          FROM movies
          ORDER BY id ASC
        `

    const result = await queryContabo<{ id: number; type: string; updated_at?: string }>(sql, [])

    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching movies for sitemap:`, error)
    return []
  }
}

/**
 * Fetch all actors for sitemap from Contabo
 */
export async function fetchAllActorsForSitemapFromContabo(): Promise<Array<{ id: number; updated_at?: string }>> {
  try {
    const sql = `
          SELECT id, updated_at
          FROM actors
          ORDER BY id ASC
        `

    const result = await queryContabo<{ id: number; updated_at?: string }>(sql, [])

    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching actors for sitemap:`, error)
    return []
  }
}

/**
 * Fetch ads from Contabo
 */
export async function fetchAdsFromContabo(position?: string): Promise<any> {
  try {
    if (position) {
      const sql = `
            SELECT *
            FROM advertisements
            WHERE position = $1 AND is_active = true
            LIMIT 1
          `
      const result = await queryContabo<any>(sql, [position])

      if (result.rows.length === 0) {
        return { content: "", active: false }
      }

      const ad = result.rows[0]
      return {
        content: ad.content || "",
        active: ad.is_active || false,
      }
    }

    // Return all ads
    const sql = `
          SELECT *
          FROM advertisements
          ORDER BY position
        `
    const result = await queryContabo<any>(sql, [])
    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching ads:`, error)
    return position ? { content: "", active: false } : []
  }
}

/**
 * Fetch all genres from Contabo
 */
export async function fetchGenresFromContabo(): Promise<string[]> {
  try {
    const sql = `SELECT DISTINCT name FROM genres ORDER BY name ASC`
    const result = await queryContabo<{ name: string }>(sql)
    return result.rows.map((r) => r.name)
  } catch (error: any) {
    console.error(`[Contabo] Error fetching genres:`, error)
    return []
  }
}

/**
 * Fetch all countries from Contabo (optionally filtered by type)
 */
export async function fetchCountriesFromContabo(type?: "movie" | "series"): Promise<string[]> {
  try {
    let sql = `
      SELECT DISTINCT c.name
      FROM countries c
      JOIN movie_countries mc ON c.id = mc.country_id
      JOIN movies m ON mc.movie_id = m.id
    `
    const params: any[] = []

    if (type) {
      sql += ` WHERE m.type = $1`
      params.push(type)
    }

    sql += ` ORDER BY c.name ASC`

    const result = await queryContabo<{ name: string }>(sql, params)
    return result.rows.map((r) => r.name)
  } catch (error: any) {
    console.error(`[Contabo] Error fetching countries:`, error)
    return []
  }
}

/**
 * Fetch all years from Contabo (optionally filtered by type)
 */
export async function fetchYearsFromContabo(type?: "movie" | "series"): Promise<number[]> {
  try {
    let sql = `
      SELECT DISTINCT substring(m.release_date from 1 for 4)::int AS year
      FROM movies m
      WHERE m.release_date IS NOT NULL
        AND m.release_date <> ''
        AND m.release_date ~ '^[0-9]{4}'
    `
    const params: any[] = []

    if (type) {
      sql += ` AND m.type = $1`
      params.push(type)
    }

    sql += ` ORDER BY year DESC`

    const result = await queryContabo<{ year: number }>(sql, params)
    return result.rows.map((r) => r.year).filter((y) => !isNaN(y) && y > 1900 && y <= new Date().getFullYear() + 2)
  } catch (error: any) {
    console.error(`[Contabo] Error fetching years:`, error)
    return []
  }
}

/**
 * Fetch latest movies/series from Contabo
 */
export async function fetchLatestMoviesFromContabo(type: "movie" | "series" = "movie", limit = 20): Promise<Movie[]> {
  try {
    const sql = `
      SELECT 
        m.*,
        COALESCE(
          string_agg(DISTINCT g.name, ', '),
          ''
        ) as genres,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'photo_url', a.photo_url
          )) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as actors
      FROM movies m
      LEFT JOIN movie_actors ma ON m.id = ma.movie_id
      LEFT JOIN actors a ON ma.actor_id = a.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.type = $1
      GROUP BY m.id
      ORDER BY m.release_date DESC NULLS LAST, m.created_at DESC
      LIMIT $2
    `

    const result = await queryContabo<Movie & { genres: string; actors: any }>(sql, [type, limit])

    return result.rows.map((row: any) => ({
      ...row,
      actors: Array.isArray(row.actors) ? row.actors.filter((a: any) => a.id) : [],
      genres: row.genres || '',
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching latest movies:`, error)
    return []
  }
}

/**
 * Fetch blog posts from Contabo
 */
export async function fetchBlogPostsFromContabo(
  page = 1,
  limit = 10
): Promise<{ posts: any[]; total: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit

    const sql = `
      SELECT *
      FROM blog_posts
      WHERE published = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `

    const countSql = `
      SELECT COUNT(*) as total
      FROM blog_posts
      WHERE published = true
    `

    const [postsResult, countResult] = await Promise.all([
      queryContabo<any>(sql, [limit, offset]),
      queryContabo<{ total: string }>(countSql, []),
    ])

    const total = parseInt(countResult.rows[0]?.total || '0', 10)
    const totalPages = Math.ceil(total / limit)

    return { posts: postsResult.rows, total, totalPages }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching blog posts:`, error)
    return { posts: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch single blog post by slug from Contabo
 */
export async function fetchBlogPostFromContabo(slug: string): Promise<any | null> {
  try {
    const sql = `
      SELECT *
      FROM blog_posts
      WHERE slug = $1 AND published = true
      LIMIT 1
    `

    const result = await queryContabo<any>(sql, [slug])

    return result.rows[0] || null
  } catch (error: any) {
    console.error(`[Contabo] Error fetching blog post:`, error)
    return null
  }
}

/**
 * Fetch download links from Contabo
 */
export async function fetchDownloadLinksFromContabo(
  movieId: number,
  episodeId?: number
): Promise<any[]> {
  try {
    let sql = `
      SELECT *
      FROM download_links
      WHERE movie_id = $1 AND status = 'active'
    `
    const params: any[] = [movieId]

    if (episodeId) {
      sql += ` AND episode_id = $2`
      params.push(episodeId)
      console.log(`[Contabo] Fetching download links for movie ${movieId}, episode ${episodeId}`)
    } else {
      sql += ` AND episode_id IS NULL`
      console.log(`[Contabo] Fetching download links for movie ${movieId} (no episode)`)
    }

    sql += ` ORDER BY quality ASC`

    const result = await queryContabo<any>(sql, params)
    console.log(`[Contabo] Found ${result.rows.length} download links for movie ${movieId}${episodeId ? `, episode ${episodeId}` : ''}`)

    // Log the episode_ids found for debugging
    if (result.rows.length > 0) {
      const episodeIds = result.rows.map((r: any) => r.episode_id).filter((id: any) => id !== null)
      if (episodeIds.length > 0) {
        console.log(`[Contabo] Download links episode_ids:`, episodeIds)
      }
    }

    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching download links:`, error)
    return []
  }
}

/**
 * Fetch public site settings from Contabo
 */
export async function fetchSiteSettingsFromContabo(): Promise<any | null> {
  try {
    const { queryContabo } = await import('./contabo-pool')

    console.log(`[Contabo] Fetching site settings from Contabo...`)

    const sql = `
      SELECT 
        id,
        site_title,
        site_description,
        site_logo_url,
        site_favicon_url,
        theme_color,
        header_menu,
        footer_links,
        quick_links,
        social_links,
        footer_text,
        meta_home_title,
        meta_movies_list_title,
        meta_series_list_title,
        meta_blog_list_title,
        meta_movie_detail_title,
        meta_series_detail_title,
        meta_blog_post_title,
        meta_page_title,
        meta_movie_watch_title,
        meta_series_watch_title,
        watch_page_custom_html,
        watch_page_middle_custom_html,
        header_custom_code,
        footer_custom_code,
        enable_cache,
        cache_ttl_minutes,
        enable_image_optimization,
        max_movies_per_page,
        enable_lazy_loading,
        database_query_timeout,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_password,
        email_from,
        created_at,
        updated_at
      FROM site_settings
      WHERE id = 1
      LIMIT 1
    `

    const result = await queryContabo<any>(sql, [])

    if (!result.rows || result.rows.length === 0) {
      console.log(`[Contabo] No site settings found, attempting to create defaults...`)

      // Try to create default settings
      try {
        const insertResult = await queryContabo<any>(`
          INSERT INTO site_settings (
            id, site_title, site_description, footer_text,
            header_menu, footer_links, quick_links, social_links
          ) VALUES (
            $1, $2, $3, $4,
            $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb
          )
          RETURNING *
        `, [
          1,
          'ROCKFLIX',
          'Your favorite movies and TV shows',
          'YOUR FAVORITE MOVIES ON ROCKFLIX',
          JSON.stringify([
            { label: "Home", url: "/" },
            { label: "Movies", url: "/movies" },
            { label: "TV Shows", url: "/series" },
            { label: "Genres", url: "/genres" }
          ]),
          JSON.stringify([
            { label: "DMCA", url: "/dmca" },
            { label: "FAQs", url: "/faqs" },
            { label: "Contact", url: "/contact" },
            { label: "Sitemap", url: "/sitemap" }
          ]),
          JSON.stringify([
            {
              title: "Browse",
              links: [
                { label: "Movies", url: "/movies" },
                { label: "TV Series", url: "/series" },
                { label: "Blog", url: "/blog" }
              ]
            },
            {
              title: "Community",
              links: [
                { label: "TalkFlix", url: "/community" },
                { label: "My Profile", url: "/profile" },
                { label: "Top Rated", url: "/" }
              ]
            },
            {
              title: "Support",
              links: [
                { label: "Help Center", url: "/" },
                { label: "Contact Us", url: "/" }
              ]
            }
          ]),
          JSON.stringify([
            { platform: "facebook", url: "#" },
            { platform: "twitter", url: "#" },
            { platform: "instagram", url: "#" },
            { platform: "youtube", url: "#" }
          ])
        ])

        console.log(`[Contabo] Default settings created successfully`)
        const row = insertResult.rows[0]

        // Parse JSONB columns
        const parseJsonb = (value: any, defaultValue: any = []): any => {
          if (value === null || value === undefined) return defaultValue
          if (typeof value === 'string') {
            try {
              return JSON.parse(value)
            } catch {
              return defaultValue
            }
          }
          if (typeof value === 'object') {
            return value
          }
          return defaultValue
        }

        const settings: any = {
          ...row,
          header_menu: parseJsonb(row.header_menu, []),
          footer_links: parseJsonb(row.footer_links, []),
          quick_links: parseJsonb(row.quick_links, []),
          social_links: parseJsonb(row.social_links, []),
        }

        return settings
      } catch (insertError: any) {
        console.error(`[Contabo] Failed to create default settings:`, insertError)
        return null
      }
    }

    const row = result.rows[0]
    console.log(`[Contabo] Raw settings row:`, {
      id: row.id,
      site_title: row.site_title,
      footer_text: row.footer_text,
      has_header_menu: !!row.header_menu,
      has_footer_links: !!row.footer_links,
      has_quick_links: !!row.quick_links,
      header_menu_type: typeof row.header_menu,
      footer_links_type: typeof row.footer_links,
    })

    // Helper function to safely parse JSONB columns
    const parseJsonb = (value: any, defaultValue: any = []): any => {
      if (value === null || value === undefined) return defaultValue
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return defaultValue
        }
      }
      if (typeof value === 'object') {
        return value
      }
      return defaultValue
    }

    // Parse JSONB columns - PostgreSQL returns them as strings or objects
    // Ensure they're properly formatted as arrays/objects
    const settings: any = {
      ...row,
      header_menu: parseJsonb(row.header_menu, []),
      footer_links: parseJsonb(row.footer_links, []),
      quick_links: parseJsonb(row.quick_links, []),
      social_links: parseJsonb(row.social_links, []),
    }

    console.log(`[Contabo] Parsed site settings:`, {
      site_title: settings.site_title,
      footer_text: settings.footer_text,
      footer_links_count: Array.isArray(settings.footer_links) ? settings.footer_links.length : 0,
      quick_links_count: Array.isArray(settings.quick_links) ? settings.quick_links.length : 0,
      header_menu_count: Array.isArray(settings.header_menu) ? settings.header_menu.length : 0,
    })

    return settings
  } catch (error: any) {
    console.error(`[Contabo] Error fetching site settings:`, error)
    console.error(`[Contabo] Error details:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    })
    return null
  }
}

/**
 * Fetch users/profiles from Contabo for admin management
 */
export async function fetchUsersFromContabo(
  search?: string,
  statusFilter: "all" | "active" | "banned" = "all",
  page: number = 1,
  limit: number = 20
): Promise<{ users: any[]; total: number; totalPages: number }> {
  try {
    let sql = `
      SELECT 
        id, username, email, profile_picture_url, role, 
        is_banned, banned_at, banned_reason, last_login, created_at
      FROM profiles
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // Apply search filter
    if (search) {
      sql += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Apply status filter
    if (statusFilter === "active") {
      sql += ` AND (is_banned = false OR is_banned IS NULL)`
    } else if (statusFilter === "banned") {
      sql += ` AND is_banned = true`
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM profiles WHERE 1=1`
    const countParams: any[] = []
    let countParamIndex = 1

    if (search) {
      countSql += ` AND (username ILIKE $${countParamIndex} OR email ILIKE $${countParamIndex})`
      countParams.push(`%${search}%`)
      countParamIndex++
    }

    if (statusFilter === "active") {
      countSql += ` AND (is_banned = false OR is_banned IS NULL)`
    } else if (statusFilter === "banned") {
      countSql += ` AND is_banned = true`
    }

    // Apply pagination
    const offset = (page - 1) * limit
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    // Execute queries
    const [usersResult, countResult] = await Promise.all([
      queryContabo<any>(sql, params),
      queryContabo<{ total: string }>(countSql, countParams),
    ])

    const users = usersResult.rows || []
    const total = Number.parseInt(countResult.rows[0]?.total || '0', 10)

    return {
      users,
      total,
      totalPages: Math.ceil(total / limit),
    }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching users:`, error)
    return { users: [], total: 0, totalPages: 0 }
  }
}

/**
 * Fetch a single user/profile from Contabo
 */
export async function fetchUserFromContabo(userId: string): Promise<any | null> {
  try {
    const result = await queryContabo<any>(
      `SELECT * FROM profiles WHERE id = $1`,
      [userId]
    )
    return result.rows[0] || null
  } catch (error: any) {
    console.error(`[Contabo] Error fetching user:`, error)
    return null
  }
}

/**
 * Fetch TalkFlix reports from Contabo
 */
export async function fetchTalkFlixReportsFromContabo(
  status?: string
): Promise<any[]> {
  try {
    let sql = `
      SELECT 
        ur.*,
        jsonb_build_object('username', r.username) as reporter,
        jsonb_build_object('username', ru.username) as reported_user,
        jsonb_build_object('comment_text', pc.comment_text) as post_comments
      FROM user_reports ur
      LEFT JOIN profiles r ON ur.reporter_id = r.id
      LEFT JOIN profiles ru ON ur.reported_user_id = ru.id
      LEFT JOIN post_comments pc ON ur.comment_id = pc.id
      WHERE 1=1
    `
    const params: any[] = []

    if (status && status !== "all") {
      sql += ` AND ur.status = $1`
      params.push(status)
    }

    sql += ` ORDER BY ur.created_at DESC LIMIT 100`

    const result = await queryContabo<any>(sql, params)

    return result.rows.map((row: any) => ({
      ...row,
      reporter_username: row.reporter?.username,
      reported_username: row.reported_user?.username,
      comment_text: row.post_comments?.comment_text,
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching TalkFlix reports:`, error)
    return []
  }
}

/**
 * Fetch analytics overview from Contabo
 */
export async function fetchAnalyticsOverviewFromContabo(): Promise<any> {
  try {
    const today = new Date()
    const last7Days = new Date(today)
    last7Days.setDate(today.getDate() - 7)
    const last30Days = new Date(today)
    last30Days.setDate(today.getDate() - 30)

    const last30DaysISO = last30Days.toISOString()
    const last7DaysISO = last7Days.toISOString()

    // Total views (last 30 days)
    const totalViewsResult = await queryContabo<{ count: string }>(
      `SELECT COUNT(*) as count FROM view_analytics WHERE created_at >= $1`,
      [last30DaysISO]
    )
    const totalViews = Number.parseInt(totalViewsResult.rows[0]?.count || '0', 10)

    // Unique visitors (last 30 days) - limit to 50k for performance
    // Count distinct session_ids, excluding null/empty values
    const uniqueVisitorsResult = await queryContabo<{ session_id: string }>(
      `SELECT DISTINCT session_id FROM view_analytics 
       WHERE created_at >= $1 
       AND session_id IS NOT NULL 
       AND session_id != ''
       LIMIT 50000`,
      [last30DaysISO]
    )
    const uniqueSessionsCount = new Set(
      uniqueVisitorsResult.rows
        .map(v => v.session_id)
        .filter(id => id && id.trim() !== '')
    ).size

    console.log(`[Contabo Analytics] Unique visitors calculated: ${uniqueSessionsCount} from ${uniqueVisitorsResult.rows.length} distinct sessions`)

    // Total searches (last 30 days)
    const totalSearchesResult = await queryContabo<{ count: string }>(
      `SELECT COUNT(*) as count FROM search_analytics WHERE created_at >= $1`,
      [last30DaysISO]
    )
    const totalSearches = Number.parseInt(totalSearchesResult.rows[0]?.count || '0', 10)

    // Total player errors (last 30 days)
    const totalErrorsResult = await queryContabo<{ count: string }>(
      `SELECT COUNT(*) as count FROM player_errors WHERE created_at >= $1`,
      [last30DaysISO]
    )
    const totalErrors = Number.parseInt(totalErrorsResult.rows[0]?.count || '0', 10)

    // Most watched content (last 30 days) - limit to 50k for performance
    const mostWatchedResult = await queryContabo<{ movie_id: number; movie_title: string; movie_poster: string; movie_type: string }>(
      `SELECT 
        va.movie_id,
        m.title as movie_title,
        m.poster_url as movie_poster,
        m.type as movie_type
      FROM view_analytics va
      LEFT JOIN movies m ON va.movie_id = m.id
      WHERE va.created_at >= $1 AND va.movie_id IS NOT NULL
      LIMIT 50000`,
      [last30DaysISO]
    )

    const movieViewCounts: Record<number, { movie: any; count: number }> = {}
    mostWatchedResult.rows.forEach((row: any) => {
      const movieId = row.movie_id
      if (!movieViewCounts[movieId]) {
        movieViewCounts[movieId] = {
          movie: {
            id: movieId,
            title: row.movie_title,
            poster_url: row.movie_poster,
            type: row.movie_type
          },
          count: 0,
        }
      }
      movieViewCounts[movieId].count++
    })

    const mostWatched = Object.values(movieViewCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Popular search terms (last 30 days) - limit to 20k for performance
    const searchResult = await queryContabo<{ query: string }>(
      `SELECT query FROM search_analytics WHERE created_at >= $1 LIMIT 20000`,
      [last30DaysISO]
    )

    const searchTermCounts: Record<string, number> = {}
    searchResult.rows.forEach((row: any) => {
      const query = row.query?.toLowerCase().trim() || ''
      if (query) {
        searchTermCounts[query] = (searchTermCounts[query] || 0) + 1
      }
    })

    const popularSearches = Object.entries(searchTermCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Device breakdown (last 30 days) - limit to 50k for performance
    const deviceResult = await queryContabo<{ device_type: string }>(
      `SELECT device_type FROM view_analytics WHERE created_at >= $1 LIMIT 50000`,
      [last30DaysISO]
    )

    const deviceBreakdown: Record<string, number> = {}
    deviceResult.rows.forEach((row: any) => {
      const device = row.device_type || 'unknown'
      deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1
    })

    // Player errors by type (last 30 days)
    const errorResult = await queryContabo<{ error_type: string; player_used: string; movie_id: number; movie_title: string }>(
      `SELECT 
        pe.error_type,
        pe.player_used,
        pe.movie_id,
        m.title as movie_title
      FROM player_errors pe
      LEFT JOIN movies m ON pe.movie_id = m.id
      WHERE pe.created_at >= $1
      ORDER BY pe.created_at DESC
      LIMIT 20`,
      [last30DaysISO]
    )

    const recentErrors = errorResult.rows.map((row: any) => ({
      error_type: row.error_type,
      player_used: row.player_used,
      movie_id: row.movie_id,
      movies: row.movie_title ? { title: row.movie_title } : null
    }))

    // Daily trend data (last 7 days) - limit to 100k for performance
    const dailyTrendResult = await queryContabo<{ created_at: string }>(
      `SELECT created_at FROM view_analytics WHERE created_at >= $1 LIMIT 100000`,
      [last7DaysISO]
    )

    const dailyViewCounts: Record<string, number> = {}
    dailyTrendResult.rows.forEach((row: any) => {
      const date = new Date(row.created_at).toISOString().split('T')[0]
      dailyViewCounts[date] = (dailyViewCounts[date] || 0) + 1
    })

    const trendData = Object.entries(dailyViewCounts)
      .map(([date, count]) => ({ date, views: count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      overview: {
        totalViews,
        uniqueVisitors: uniqueSessionsCount,
        totalSearches,
        totalErrors,
      },
      mostWatched,
      popularSearches,
      deviceBreakdown,
      recentErrors,
      trendData,
    }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching analytics overview:`, error)
    return {
      overview: { totalViews: 0, uniqueVisitors: 0, totalSearches: 0, totalErrors: 0 },
      mostWatched: [],
      popularSearches: [],
      deviceBreakdown: {},
      recentErrors: [],
      trendData: [],
    }
  }
}

/**
 * Fetch posts from Contabo with various filters
 */
export async function fetchPostsFromContabo(options: {
  feed?: string
  hashtag?: string | null
  username?: string | null
  page?: number
  limit?: number
  userId?: string | null
}): Promise<{ posts: any[]; hasMore: boolean }> {
  try {
    const { feed = 'for-you', hashtag, username, page = 1, limit = 30, userId } = options
    const offset = (page - 1) * limit

    console.log(`[Contabo] 🚀 Fetching posts:`, { feed, hashtag, username, page, limit, hasUserId: !!userId })

    let postsQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.content,
        p.youtube_url,
        p.image_url,
        p.likes_count,
        p.comments_count,
        p.repost_count,
        p.created_at,
        p.updated_at
      FROM posts p
    `
    const queryParams: any[] = []
    let paramCount = 0

    // Build WHERE clause based on feed type
    if (username) {
      // Get user ID from username
      const userResult = await queryContabo<{ id: string }>(
        'SELECT id FROM profiles WHERE username = $1',
        [username]
      )
      if (userResult.rows.length === 0) {
        return { posts: [], hasMore: false }
      }
      paramCount++
      postsQuery += ` WHERE p.user_id = $${paramCount}`
      queryParams.push(userResult.rows[0].id)
    } else if (hashtag) {
      // Get hashtag ID
      const hashtagResult = await queryContabo<{ id: number }>(
        'SELECT id FROM hashtags WHERE name = $1',
        [hashtag.toLowerCase()]
      )
      if (hashtagResult.rows.length === 0) {
        return { posts: [], hasMore: false }
      }
      const hashtagId = hashtagResult.rows[0].id

      // Get post IDs with this hashtag
      const postHashtagsResult = await queryContabo<{ post_id: number }>(
        'SELECT post_id FROM post_hashtags WHERE hashtag_id = $1',
        [hashtagId]
      )
      const postIds = postHashtagsResult.rows.map(r => r.post_id)
      if (postIds.length === 0) {
        return { posts: [], hasMore: false }
      }
      paramCount++
      postsQuery += ` WHERE p.id = ANY($${paramCount}::bigint[])`
      queryParams.push(postIds)
    } else if (feed === 'following' && userId) {
      // Get following IDs
      const followingResult = await queryContabo<{ following_id: string }>(
        'SELECT following_id FROM user_follows WHERE follower_id = $1',
        [userId]
      )
      const followingIds = followingResult.rows.map(r => r.following_id)
      if (followingIds.length === 0) {
        return { posts: [], hasMore: false }
      }
      paramCount++
      postsQuery += ` WHERE p.user_id = ANY($${paramCount}::uuid[])`
      queryParams.push(followingIds)
    } else if (feed === 'trending') {
      // For trending, show ANY posts ordered by engagement (no date restriction)
      // This ensures we always show posts if they exist
      console.log(`[Contabo] Trending feed - fetching ANY posts ordered by engagement`)
      // No WHERE clause - we want all posts
    } else if (feed === 'for-you' && userId) {
      // Complex "for-you" algorithm - simplified version
      // Get posts from users you've engaged with, trending posts, and recent posts
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      // Get users you've liked/commented on
      const engagedUsersResult = await queryContabo<{ user_id: string }>(
        `SELECT DISTINCT p.user_id 
         FROM post_likes pl
         JOIN posts p ON pl.post_id = p.id
         WHERE pl.user_id = $1
         UNION
         SELECT DISTINCT p.user_id
         FROM post_comments pc
         JOIN posts p ON pc.post_id = p.id
         WHERE pc.user_id = $1`,
        [userId]
      )
      const engagedUserIds = engagedUsersResult.rows.map(r => r.user_id)

      // Get trending post IDs (last 24 hours, 2+ likes)
      const trendingResult = await queryContabo<{ id: number }>(
        `SELECT id FROM posts 
         WHERE created_at >= $1 AND likes_count >= 2 
         ORDER BY likes_count DESC, comments_count DESC 
         LIMIT 20`,
        [yesterday.toISOString()]
      )
      const trendingPostIds = trendingResult.rows.map(r => r.id)

      // Get recent post IDs (last 6 hours)
      const sixHoursAgo = new Date()
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6)
      const recentResult = await queryContabo<{ id: number }>(
        `SELECT id FROM posts 
         WHERE created_at >= $1 
         ORDER BY created_at DESC 
         LIMIT 30`,
        [sixHoursAgo.toISOString()]
      )
      const recentPostIds = recentResult.rows.map(r => r.id)

      // Combine all relevant post IDs
      const allPostIds = [...new Set([...trendingPostIds, ...recentPostIds])]

      if (engagedUserIds.length > 0 || allPostIds.length > 0) {
        const conditions: string[] = []
        if (engagedUserIds.length > 0) {
          paramCount++
          conditions.push(`p.user_id = ANY($${paramCount}::uuid[])`)
          queryParams.push(engagedUserIds)
        }
        if (allPostIds.length > 0) {
          paramCount++
          conditions.push(`p.id = ANY($${paramCount}::bigint[])`)
          queryParams.push(allPostIds)
        }
        if (conditions.length > 0) {
          postsQuery += ` WHERE (${conditions.join(' OR ')})`
        }
      } else {
        // Fallback to last 12 hours
        const twelveHoursAgo = new Date()
        twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12)
        paramCount++
        postsQuery += ` WHERE p.created_at >= $${paramCount}`
        queryParams.push(twelveHoursAgo.toISOString())
      }
    }

    // Add ORDER BY and LIMIT
    if (feed === 'trending') {
      // Order by engagement: likes + comments, then by date
      postsQuery += ` ORDER BY (p.likes_count + p.comments_count) DESC, p.created_at DESC`
    } else {
      postsQuery += ` ORDER BY p.created_at DESC`
    }
    paramCount++
    postsQuery += ` LIMIT $${paramCount}`
    queryParams.push(limit + 1) // Fetch one extra to check hasMore
    paramCount++
    postsQuery += ` OFFSET $${paramCount}`
    queryParams.push(offset)

    console.log(`[Contabo] Executing query: ${postsQuery}`, queryParams)

    let postsResult
    try {
      postsResult = await queryContabo<any>(postsQuery, queryParams)
      console.log(`[Contabo] Query executed successfully, found ${postsResult.rows?.length || 0} rows`)
    } catch (error: any) {
      console.error(`[Contabo] Query execution error:`, error)
      throw error
    }

    const posts = postsResult.rows?.slice(0, limit) || []
    const hasMore = (postsResult.rows?.length || 0) > limit

    console.log(`[Contabo] Fetched ${posts.length} posts for feed: ${feed}, hasMore: ${hasMore}`)

    // No fallback needed - trending query already fetches all posts without date restriction

    // Debug: If no posts, check total count in database
    if (posts.length === 0) {
      console.log(`[Contabo] ⚠️ No posts found for feed: ${feed}`)
      try {
        const countResult = await queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM posts')
        const totalCount = parseInt(countResult.rows[0]?.count || '0', 10)
        console.log(`[Contabo] 🔍 Total posts in database: ${totalCount}`)

        if (totalCount > 0 && feed === 'trending') {
          // Try fetching without any WHERE clause to see if it works
          const testQuery = `SELECT id, user_id, content, likes_count, comments_count, created_at FROM posts ORDER BY created_at DESC LIMIT 5`
          const testResult = await queryContabo<any>(testQuery)
          console.log(`[Contabo] 🔍 Test query found ${testResult.rows?.length || 0} posts`)
          if (testResult.rows?.length > 0) {
            console.log(`[Contabo] 📋 Sample post:`, testResult.rows[0])
          }
        }
      } catch (debugError: any) {
        console.error(`[Contabo] ❌ Debug error:`, debugError.message)
      }
      return { posts: [], hasMore: false }
    }

    // Get post IDs
    const postIds = posts.map(p => p.id)

    // If no posts, return early
    if (postIds.length === 0) {
      console.log(`[Contabo] No posts found, returning empty array`)
      return { posts: [], hasMore: false }
    }

    // Fetch profiles for posts
    const userIds = [...new Set(posts.map(p => p.user_id))]

    let profileMap = new Map()
    if (userIds.length > 0) {
      try {
        const profilesResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
          `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
          [userIds]
        )
        profileMap = new Map(profilesResult.rows?.map(p => [p.id, p]) || [])
      } catch (profileError: any) {
        console.error(`[Contabo] Error fetching profiles:`, profileError)
        // Continue with empty profile map
      }
    }

    // Fetch likes for current user
    let userLikes: Set<number> = new Set()
    if (userId && postIds.length > 0) {
      try {
        const likesResult = await queryContabo<{ post_id: number }>(
          `SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::bigint[])`,
          [userId, postIds]
        )
        userLikes = new Set((likesResult.rows || []).map(l => l.post_id))
      } catch (likesError: any) {
        console.error(`[Contabo] Error fetching likes:`, likesError)
        // Continue with empty likes set
      }
    }

    // Fetch hashtags for posts
    let hashtagsMap = new Map<number, string[]>()
    if (postIds.length > 0) {
      try {
        const hashtagsResult = await queryContabo<{ post_id: number; name: string }>(
          `SELECT ph.post_id, h.name 
           FROM post_hashtags ph
           JOIN hashtags h ON ph.hashtag_id = h.id
           WHERE ph.post_id = ANY($1::bigint[])`,
          [postIds]
        )
          ; (hashtagsResult.rows || []).forEach(row => {
            if (!hashtagsMap.has(row.post_id)) {
              hashtagsMap.set(row.post_id, [])
            }
            hashtagsMap.get(row.post_id)!.push(row.name)
          })
      } catch (hashtagsError: any) {
        console.error(`[Contabo] Error fetching hashtags:`, hashtagsError)
        // Continue with empty hashtags map
      }
    }

    // Fetch movies for posts
    let moviesMap = new Map<number, any[]>()
    if (postIds.length > 0) {
      try {
        const moviesResult = await queryContabo<{ post_id: number; movie_id: number; title: string; poster_url: string | null; type: string }>(
          `SELECT pm.post_id, m.id as movie_id, m.title, m.poster_url, m.type
           FROM post_movies pm
           JOIN movies m ON pm.movie_id = m.id
           WHERE pm.post_id = ANY($1::bigint[])`,
          [postIds]
        )
          ; (moviesResult.rows || []).forEach(row => {
            if (!moviesMap.has(row.post_id)) {
              moviesMap.set(row.post_id, [])
            }
            moviesMap.get(row.post_id)!.push({
              id: row.movie_id,
              title: row.title,
              poster_url: row.poster_url,
              type: row.type
            })
          })
      } catch (moviesError: any) {
        console.error(`[Contabo] Error fetching movies:`, moviesError)
        // Continue with empty movies map
      }
    }

    // Format posts
    const formattedPosts = posts.map(post => ({
      ...post,
      profiles: profileMap.get(post.user_id) || null,
      isLiked: userLikes.has(post.id),
      hashtags: hashtagsMap.get(post.id) || [],
      post_movies: moviesMap.get(post.id) || [],
      post_likes: undefined,
      type: 'post'
    }))

    // Fetch reposts (quotes) if not hashtag feed
    let reposts: any[] = []
    if (!hashtag) {
      let repostsQuery = `
        SELECT 
          pr.id as repost_id,
          pr.post_id,
          pr.user_id,
          pr.quote_content,
          pr.created_at,
          p.id as original_post_id,
          p.user_id as original_user_id,
          p.content,
          p.youtube_url,
          p.image_url,
          p.likes_count,
          p.comments_count,
          p.repost_count,
          p.created_at as original_created_at
        FROM post_reposts pr
        JOIN posts p ON pr.post_id = p.id
        WHERE pr.quote_content IS NOT NULL
      `
      const repostParams: any[] = []
      let repostParamCount = 0

      if (username) {
        const userResult = await queryContabo<{ id: string }>(
          'SELECT id FROM profiles WHERE username = $1',
          [username]
        )
        if (userResult.rows.length > 0) {
          repostParamCount++
          repostsQuery += ` AND pr.user_id = $${repostParamCount}`
          repostParams.push(userResult.rows[0].id)
        }
      }

      repostsQuery += ` ORDER BY pr.created_at DESC LIMIT ${Math.floor(limit / 2)}`

      const repostsResult = await queryContabo<any>(repostsQuery, repostParams)

      if (repostsResult.rows.length > 0) {
        const reposterIds = [...new Set(repostsResult.rows.map(r => r.user_id))]
        const originalUserIds = [...new Set(repostsResult.rows.map(r => r.original_user_id))]
        const allRepostUserIds = [...new Set([...reposterIds, ...originalUserIds])]

        const repostProfilesResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
          `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
          [allRepostUserIds]
        )
        const repostProfileMap = new Map(repostProfilesResult.rows.map(p => [p.id, p]))

        // Fetch movies for original posts in reposts
        const originalPostIds = repostsResult.rows.map(r => r.original_post_id)
        const repostMoviesResult = await queryContabo<{ post_id: number; movie_id: number; title: string; poster_url: string | null; type: string }>(
          `SELECT pm.post_id, m.id as movie_id, m.title, m.poster_url, m.type
           FROM post_movies pm
           JOIN movies m ON pm.movie_id = m.id
           WHERE pm.post_id = ANY($1::bigint[])`,
          [originalPostIds]
        )
        const repostMoviesMap = new Map<number, any[]>()
        repostMoviesResult.rows.forEach(row => {
          if (!repostMoviesMap.has(row.post_id)) {
            repostMoviesMap.set(row.post_id, [])
          }
          repostMoviesMap.get(row.post_id)!.push({
            id: row.movie_id,
            title: row.title,
            poster_url: row.poster_url,
            type: row.type
          })
        })

        reposts = repostsResult.rows.map(repost => ({
          id: `repost-${repost.repost_id}`,
          repost_id: repost.repost_id,
          quote_content: repost.quote_content,
          created_at: repost.created_at,
          profiles: repostProfileMap.get(repost.user_id) || null,
          original_post: {
            id: repost.original_post_id,
            user_id: repost.original_user_id,
            content: repost.content,
            youtube_url: repost.youtube_url,
            image_url: repost.image_url,
            likes_count: repost.likes_count,
            comments_count: repost.comments_count,
            repost_count: repost.repost_count,
            created_at: repost.original_created_at,
            profiles: repostProfileMap.get(repost.original_user_id) || null,
            post_movies: repostMoviesMap.get(repost.original_post_id) || []
          },
          type: 'quote',
          likes_count: 0,
          comments_count: 0,
          repost_count: 0
        }))
      }
    }

    // Combine posts and reposts, sort by date
    const allItems = [...formattedPosts, ...reposts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    console.log(`[Contabo] ✅ Successfully fetched and formatted posts:`, {
      totalItems: allItems.length,
      returningCount: Math.min(allItems.length, limit),
      hasMore,
    })

    const finalPosts = allItems.slice(0, limit)
    console.log(`[Contabo] ✅ Successfully fetched ${finalPosts.length} posts`)

    return {
      posts: finalPosts,
      hasMore
    }
  } catch (error: any) {
    console.error(`[Contabo] ❌ Error fetching posts (returning empty):`, {
      message: error?.message || 'Unknown error',
      code: error?.code,
      name: error?.name,
    })
    // ALWAYS return empty array - never throw
    return { posts: [], hasMore: false }
  }
}

/**
 * Search posts, users, and hashtags in Contabo
 */
export async function searchCommunityFromContabo(query: string, userId?: string | null): Promise<{
  posts: any[]
  users: any[]
  hashtags: any[]
}> {
  try {
    if (!query || !query.trim()) {
      return { posts: [], users: [], hashtags: [] }
    }

    const searchTerm = `%${query.toLowerCase()}%`

    // Search posts
    const postsResult = await queryContabo<{
      id: number
      user_id: string
      content: string
      youtube_url: string | null
      image_url: string | null
      likes_count: number
      comments_count: number
      repost_count: number
      created_at: string
    }>(
      `SELECT 
        p.id, p.user_id, p.content, p.youtube_url, p.image_url,
        p.likes_count, p.comments_count, p.repost_count, p.created_at
       FROM posts p
       WHERE LOWER(p.content) LIKE $1
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [searchTerm]
    )

    // Search users
    const usersResult = await queryContabo<{
      id: string
      username: string
      profile_picture_url: string | null
      about: string | null
    }>(
      `SELECT id, username, profile_picture_url, about
       FROM profiles
       WHERE LOWER(username) LIKE $1 OR LOWER(COALESCE(about, '')) LIKE $1
       LIMIT 20`,
      [searchTerm]
    )

    // Search hashtags
    const hashtagsResult = await queryContabo<{
      id: number
      name: string
      post_count: number
      created_at: string
    }>(
      `SELECT id, name, post_count, created_at
       FROM hashtags
       WHERE LOWER(name) LIKE $1
       ORDER BY post_count DESC
       LIMIT 20`,
      [searchTerm]
    )

    // Get post IDs and user IDs
    const postIds = postsResult.rows.map(p => p.id)
    const userIds = [...new Set(postsResult.rows.map(p => p.user_id))]

    // Fetch profiles for posts
    let profileMap = new Map()
    if (userIds.length > 0) {
      const profilesResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
        `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
        [userIds]
      )
      profileMap = new Map(profilesResult.rows.map(p => [p.id, p]))
    }

    // Fetch likes for current user
    let userLikes: Set<number> = new Set()
    if (userId && postIds.length > 0) {
      const likesResult = await queryContabo<{ post_id: number }>(
        `SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::bigint[])`,
        [userId, postIds]
      )
      userLikes = new Set(likesResult.rows.map(l => l.post_id))
    }

    // Format posts with profiles and like status
    const formattedPosts = postsResult.rows.map(post => ({
      ...post,
      profiles: profileMap.get(post.user_id) || null,
      isLiked: userLikes.has(post.id),
    }))

    return {
      posts: formattedPosts,
      users: usersResult.rows,
      hashtags: hashtagsResult.rows,
    }
  } catch (error: any) {
    console.error(`[Contabo] Error searching community:`, error)
    return { posts: [], users: [], hashtags: [] }
  }
}

/**
 * Fetch TalkFlix notifications from Contabo
 */
export async function fetchNotificationsFromContabo(options: {
  userId: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
}): Promise<any[]> {
  try {
    const { userId, unreadOnly = false, limit = 20, offset = 0 } = options

    let query = `
      SELECT 
        id, user_id, actor_id, notification_type, post_id, comment_id,
        content, read, created_at
      FROM talkflix_notifications
      WHERE user_id = $1
    `
    const queryParams: any[] = [userId]

    if (unreadOnly) {
      query += ` AND read = false`
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`
    queryParams.push(limit, offset)

    const notificationsResult = await queryContabo<{
      id: number
      user_id: string
      actor_id: string
      notification_type: string
      post_id: number | null
      comment_id: number | null
      content: string | null
      read: boolean
      created_at: string
    }>(query, queryParams)

    if (notificationsResult.rows.length === 0) {
      return []
    }

    // Get unique actor IDs
    const actorIds = [...new Set(notificationsResult.rows.map(n => n.actor_id))]

    // Fetch actor profiles
    let actors: any[] = []
    if (actorIds.length > 0) {
      const batchSize = 1000
      for (let i = 0; i < actorIds.length; i += batchSize) {
        const batch = actorIds.slice(i, i + batchSize)
        const actorsResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
          `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
          [batch]
        )
        actors = actors.concat(actorsResult.rows)
      }
    }

    // Create actor map
    const actorMap = new Map(actors.map(a => [a.id, a]))

    // Merge data
    return notificationsResult.rows.map(notification => ({
      ...notification,
      actor: actorMap.get(notification.actor_id) || null,
    }))
  } catch (error: any) {
    console.error(`[Contabo] Error fetching notifications:`, error)
    return []
  }
}

/**
 * Fetch post comments from Contabo
 */
export async function fetchPostCommentsFromContabo(postId: number, userId?: string | null): Promise<any[]> {
  try {
    // Fetch all comments for the post
    const commentsResult = await queryContabo<{
      id: number
      post_id: number
      user_id: string
      content: string
      parent_comment_id: number | null
      likes_count: number
      dislikes_count: number
      created_at: string
    }>(
      `SELECT 
        id, post_id, user_id, content, parent_comment_id,
        likes_count, dislikes_count, created_at
       FROM post_comments
       WHERE post_id = $1
       ORDER BY created_at ASC`,
      [postId]
    )

    if (commentsResult.rows.length === 0) {
      return []
    }

    // Get user IDs
    const userIds = [...new Set(commentsResult.rows.map(c => c.user_id))]

    // Fetch profiles
    const profilesResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
      [userIds]
    )
    const profileMap = new Map(profilesResult.rows.map(p => [p.id, p]))

    // Fetch user reactions if user is logged in
    let userReactions: Record<number, string> = {}
    if (userId) {
      const commentIds = commentsResult.rows.map(c => c.id)
      if (commentIds.length > 0) {
        const reactionsResult = await queryContabo<{ comment_id: number; is_like: boolean }>(
          `SELECT comment_id, is_like 
           FROM comment_likes 
           WHERE user_id = $1 AND comment_id = ANY($2::bigint[])`,
          [userId, commentIds]
        )
        userReactions = reactionsResult.rows.reduce(
          (acc, r) => ({
            ...acc,
            [r.comment_id]: r.is_like ? 'like' : 'dislike',
          }),
          {} as Record<number, string>
        )
      }
    }

    // Format comments with profiles and reactions
    const commentsWithProfiles = commentsResult.rows.map(comment => ({
      ...comment,
      profiles: profileMap.get(comment.user_id) || null,
      userReaction: userReactions[comment.id] || null,
      engagementScore: (comment.likes_count || 0) - (comment.dislikes_count || 0),
    }))

    // Organize into threads (top-level comments and replies)
    const topLevelComments = commentsWithProfiles.filter(c => !c.parent_comment_id)
    const repliesMap = new Map<number, any[]>()

    commentsWithProfiles.forEach(comment => {
      if (comment.parent_comment_id) {
        if (!repliesMap.has(comment.parent_comment_id)) {
          repliesMap.set(comment.parent_comment_id, [])
        }
        repliesMap.get(comment.parent_comment_id)!.push(comment)
      }
    })

    const threaded = topLevelComments.map(comment => {
      const replies = repliesMap.get(comment.id) || []
      const sortedReplies = replies.sort((a, b) => b.engagementScore - a.engagementScore)
      return {
        ...comment,
        replies: sortedReplies,
      }
    })

    return threaded.sort((a, b) => b.engagementScore - a.engagementScore)
  } catch (error: any) {
    console.error(`[Contabo] Error fetching post comments:`, error)
    return []
  }
}

/**
 * Fetch bookmarks from Contabo
 */
export async function fetchBookmarksFromContabo(userId: string): Promise<any[]> {
  try {
    const bookmarksResult = await queryContabo<{
      id: number
      post_id: number
      user_id: string
      created_at: string
    }>(
      `SELECT id, post_id, user_id, created_at
       FROM bookmarks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    )

    if (bookmarksResult.rows.length === 0) {
      return []
    }

    const postIds = bookmarksResult.rows.map(b => b.post_id)

    // Fetch posts
    const postsResult = await queryContabo<{
      id: number
      user_id: string
      content: string
      image_url: string | null
      youtube_url: string | null
      likes_count: number
      comments_count: number
      repost_count: number
      created_at: string
    }>(
      `SELECT 
        id, user_id, content, image_url, youtube_url,
        likes_count, comments_count, repost_count, created_at
       FROM posts
       WHERE id = ANY($1::bigint[])`,
      [postIds]
    )

    // Get user IDs for posts
    const userIds = [...new Set(postsResult.rows.map(p => p.user_id))]

    // Fetch profiles
    const profilesResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
      [userIds]
    )
    const profileMap = new Map(profilesResult.rows.map(p => [p.id, p]))

    // Create post map
    const postMap = new Map(postsResult.rows.map(p => [p.id, p]))

    // Combine bookmarks with posts
    return bookmarksResult.rows.map(bookmark => {
      const post = postMap.get(bookmark.post_id)
      if (!post) return null

      return {
        id: bookmark.id,
        created_at: bookmark.created_at,
        post_id: bookmark.post_id,
        posts: {
          ...post,
          profiles: profileMap.get(post.user_id) || null,
        },
      }
    }).filter(b => b !== null) as any[]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching bookmarks:`, error)
    return []
  }
}

/**
 * Fetch trending hashtags from Contabo
 */
export async function fetchTrendingHashtagsFromContabo(limit: number = 10): Promise<any[]> {
  try {
    const result = await queryContabo<{
      id: number
      name: string
      post_count: number
      created_at: string
    }>(
      `SELECT id, name, post_count, created_at
       FROM hashtags
       ORDER BY post_count DESC
       LIMIT $1`,
      [limit]
    )
    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching trending hashtags:`, error)
    return []
  }
}

/**
 * Fetch a single post detail from Contabo
 */
export async function fetchPostDetailFromContabo(postId: number, userId?: string | null): Promise<any | null> {
  try {
    const postResult = await queryContabo<{
      id: number
      user_id: string
      content: string
      youtube_url: string | null
      image_url: string | null
      likes_count: number
      comments_count: number
      repost_count: number
      created_at: string
      updated_at: string
    }>(
      `SELECT 
        id, user_id, content, youtube_url, image_url,
        likes_count, comments_count, repost_count, created_at, updated_at
       FROM posts
       WHERE id = $1`,
      [postId]
    )

    if (postResult.rows.length === 0) {
      return null
    }

    const post = postResult.rows[0]

    // Fetch profile
    const profileResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      'SELECT id, username, profile_picture_url FROM profiles WHERE id = $1',
      [post.user_id]
    )
    const profile = profileResult.rows[0] || null

    // Fetch movies
    const moviesResult = await queryContabo<{ movie_id: number; title: string; poster_url: string | null; type: string }>(
      `SELECT m.id as movie_id, m.title, m.poster_url, m.type
       FROM post_movies pm
       JOIN movies m ON pm.movie_id = m.id
       WHERE pm.post_id = $1`,
      [postId]
    )
    const movies = moviesResult.rows.map(m => ({
      id: m.movie_id,
      title: m.title,
      poster_url: m.poster_url,
      type: m.type,
    }))

    // Fetch hashtags
    const hashtagsResult = await queryContabo<{ name: string }>(
      `SELECT h.name 
       FROM post_hashtags ph
       JOIN hashtags h ON ph.hashtag_id = h.id
       WHERE ph.post_id = $1`,
      [postId]
    )
    const hashtags = hashtagsResult.rows.map(h => h.name)

    // Check if user liked the post
    let isLiked = false
    if (userId) {
      const likeResult = await queryContabo<{ id: number }>(
        `SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      )
      isLiked = likeResult.rows.length > 0
    }

    return {
      ...post,
      profiles: profile || { id: '', username: 'unknown', profile_picture_url: '' },
      post_movies: movies,
      hashtags: hashtags,
      isLiked: isLiked,
      post_likes: undefined,
    }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching post detail:`, error)
    return null
  }
}

/**
 * Fetch post interactions (likes, comments, reposts) from Contabo
 */
export async function fetchPostInteractionsFromContabo(postId: number, userId?: string | null): Promise<{
  likes_count: number
  comments_count: number
  repost_count: number
  isLiked: boolean
  isReposted: boolean
}> {
  try {
    const postResult = await queryContabo<{
      likes_count: number
      comments_count: number
      repost_count: number
    }>(
      `SELECT likes_count, comments_count, repost_count
       FROM posts
       WHERE id = $1`,
      [postId]
    )

    if (postResult.rows.length === 0) {
      return {
        likes_count: 0,
        comments_count: 0,
        repost_count: 0,
        isLiked: false,
        isReposted: false,
      }
    }

    const post = postResult.rows[0]

    let isLiked = false
    let isReposted = false

    if (userId) {
      // Check if user liked
      const likeResult = await queryContabo<{ id: number }>(
        `SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      )
      isLiked = likeResult.rows.length > 0

      // Check if user reposted
      const repostResult = await queryContabo<{ id: number }>(
        `SELECT id FROM post_reposts WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      )
      isReposted = repostResult.rows.length > 0
    }

    return {
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      repost_count: post.repost_count || 0,
      isLiked,
      isReposted,
    }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching post interactions:`, error)
    return {
      likes_count: 0,
      comments_count: 0,
      repost_count: 0,
      isLiked: false,
      isReposted: false,
    }
  }
}

/**
 * Get user's reaction status for a comment from Contabo
 */
export async function getCommentReactionFromContabo(commentId: number, userId: string): Promise<string | null> {
  try {
    const result = await queryContabo<{ is_like: boolean }>(
      `SELECT is_like FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0].is_like ? 'like' : 'dislike'
  } catch (error: any) {
    console.error(`[Contabo] Error fetching comment reaction:`, error)
    return null
  }
}

/**
 * Fetch notification preferences from Contabo
 */
export async function fetchNotificationPreferencesFromContabo(userId: string): Promise<any | null> {
  try {
    const result = await queryContabo<{
      id: number
      user_id: string
      email_new_episodes: boolean
      email_comment_replies: boolean
      email_weekly_digest: boolean
      email_new_favorites: boolean
      email_marketing: boolean
      digest_frequency: string
      last_digest_sent_at: string | null
      created_at: string
      updated_at: string
    }>(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // Create default preferences
      const defaultResult = await queryContabo<{
        id: number
        user_id: string
        email_new_episodes: boolean
        email_comment_replies: boolean
        email_weekly_digest: boolean
        email_new_favorites: boolean
        email_marketing: boolean
        digest_frequency: string
        last_digest_sent_at: string | null
        created_at: string
        updated_at: string
      }>(
        `INSERT INTO notification_preferences (
          user_id, email_new_episodes, email_comment_replies, email_weekly_digest,
          email_new_favorites, email_marketing, digest_frequency, created_at, updated_at
        )
        VALUES ($1, true, true, true, false, false, 'weekly', NOW(), NOW())
        RETURNING *`,
        [userId]
      )
      return defaultResult.rows[0] || null
    }

    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching notification preferences:`, error)
    return null
  }
}

/**
 * Get unread notification count from Contabo
 */
export async function getUnreadNotificationCountFromContabo(userId: string): Promise<number> {
  try {
    const result = await queryContabo<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM talkflix_notifications 
       WHERE user_id = $1 AND read = false`,
      [userId]
    )
    return parseInt(result.rows[0]?.count || '0', 10)
  } catch (error: any) {
    console.error(`[Contabo] Error fetching unread notification count:`, error)
    return 0
  }
}

/**
 * Fetch followed series from Contabo
 */
export async function fetchFollowedSeriesFromContabo(userId: string): Promise<any[]> {
  try {
    const result = await queryContabo<{
      id: number
      series_id: number
      created_at: string
    }>(
      `SELECT id, series_id, created_at
       FROM series_followers
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    )

    if (result.rows.length === 0) {
      return []
    }

    const seriesIds = result.rows.map(r => r.series_id)

    // Fetch series details
    const seriesResult = await queryContabo<{
      id: number
      title: string
      poster_url: string | null
      rating: number | null
      total_seasons: number | null
    }>(
      `SELECT id, title, poster_url, rating, total_seasons
       FROM movies
       WHERE id = ANY($1::bigint[]) AND type = 'series'`,
      [seriesIds]
    )

    // Create map
    const seriesMap = new Map(seriesResult.rows.map(s => [s.id, s]))

    // Combine with follower data
    return result.rows.map(follower => {
      const series = seriesMap.get(follower.series_id)
      if (!series) return null

      return {
        id: follower.id,
        series_id: follower.series_id,
        created_at: follower.created_at,
        movies: {
          id: series.id,
          title: series.title,
          poster_url: series.poster_url,
          rating: series.rating,
          total_seasons: series.total_seasons,
        },
      }
    }).filter(item => item !== null) as any[]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching followed series:`, error)
    return []
  }
}

/**
 * Fetch quote/repost detail from Contabo
 */
export async function fetchQuoteDetailFromContabo(repostId: number, userId?: string | null): Promise<any | null> {
  try {
    // Fetch the repost/quote
    const repostResult = await queryContabo<{
      id: number
      post_id: number
      user_id: string
      quote_content: string | null
      created_at: string
    }>(
      `SELECT id, post_id, user_id, quote_content, created_at
       FROM post_reposts
       WHERE id = $1`,
      [repostId]
    )

    if (repostResult.rows.length === 0) {
      return null
    }

    const repost = repostResult.rows[0]

    // Fetch reposter profile
    const reposterProfileResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      'SELECT id, username, profile_picture_url FROM profiles WHERE id = $1',
      [repost.user_id]
    )
    const reposterProfile = reposterProfileResult.rows[0] || null

    // Fetch original post
    const originalPostResult = await queryContabo<{
      id: number
      user_id: string
      content: string
      youtube_url: string | null
      image_url: string | null
      likes_count: number
      comments_count: number
      repost_count: number
      created_at: string
      updated_at: string
    }>(
      `SELECT 
        id, user_id, content, youtube_url, image_url,
        likes_count, comments_count, repost_count, created_at, updated_at
       FROM posts
       WHERE id = $1`,
      [repost.post_id]
    )

    if (originalPostResult.rows.length === 0) {
      return null
    }

    const originalPost = originalPostResult.rows[0]

    // Fetch original post author profile
    const originalProfileResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      'SELECT id, username, profile_picture_url FROM profiles WHERE id = $1',
      [originalPost.user_id]
    )
    const originalProfile = originalProfileResult.rows[0] || null

    // Fetch post movies for original post
    const moviesResult = await queryContabo<{ movie_id: number; title: string; poster_url: string | null; type: string }>(
      `SELECT m.id as movie_id, m.title, m.poster_url, m.type
       FROM post_movies pm
       JOIN movies m ON pm.movie_id = m.id
       WHERE pm.post_id = $1`,
      [originalPost.id]
    )
    const movies = moviesResult.rows.map(m => ({
      id: m.movie_id,
      title: m.title,
      poster_url: m.poster_url,
      type: m.type,
    }))

    return {
      id: repost.post_id.toString(),
      repost_id: repost.id,
      quote_content: repost.quote_content,
      created_at: repost.created_at,
      profiles: reposterProfile || { id: '', username: 'unknown', profile_picture_url: '' },
      original_post: {
        ...originalPost,
        profiles: originalProfile || { id: '', username: 'unknown', profile_picture_url: '' },
        post_movies: movies,
      },
      type: 'quote',
    }
  } catch (error: any) {
    console.error(`[Contabo] Error fetching quote detail:`, error)
    return null
  }
}

/**
 * Fetch user profile by username from Contabo
 */
export async function fetchProfileByUsernameFromContabo(username: string): Promise<any | null> {
  try {
    const result = await queryContabo<{
      id: string
      username: string
      profile_picture_url: string | null
      about: string | null
      country: string | null
      role: string
      created_at: string
      email?: string
    }>(
      `SELECT id, username, profile_picture_url, about, country, role, created_at
       FROM profiles
       WHERE username = $1`,
      [username]
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching profile by username:`, error)
    return null
  }
}

/**
 * Fetch user posts from Contabo
 */
export async function fetchUserPostsFromContabo(userId: string, limit: number = 50): Promise<any[]> {
  try {
    const result = await queryContabo<{
      id: number
      user_id: string
      content: string
      youtube_url: string | null
      image_url: string | null
      likes_count: number
      comments_count: number
      repost_count: number
      created_at: string
      updated_at: string
    }>(
      `SELECT 
        id, user_id, content, youtube_url, image_url,
        likes_count, comments_count, repost_count, created_at, updated_at
       FROM posts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    )

    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching user posts:`, error)
    return []
  }
}

/**
 * Get followers count from Contabo
 */
export async function getFollowersCountFromContabo(userId: string): Promise<number> {
  try {
    const result = await queryContabo<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM user_follows 
       WHERE following_id = $1`,
      [userId]
    )
    return parseInt(result.rows[0]?.count || '0', 10)
  } catch (error: any) {
    console.error(`[Contabo] Error getting followers count:`, error)
    return 0
  }
}

/**
 * Get following count from Contabo
 */
export async function getFollowingCountFromContabo(userId: string): Promise<number> {
  try {
    const result = await queryContabo<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM user_follows 
       WHERE follower_id = $1`,
      [userId]
    )
    return parseInt(result.rows[0]?.count || '0', 10)
  } catch (error: any) {
    console.error(`[Contabo] Error getting following count:`, error)
    return 0
  }
}

/**
 * Check if user follows another user in Contabo
 */
export async function checkFollowStatusFromContabo(followerId: string, followingId: string): Promise<boolean> {
  try {
    const result = await queryContabo<{ id: number }>(
      `SELECT id FROM user_follows 
       WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    )
    return result.rows.length > 0
  } catch (error: any) {
    console.error(`[Contabo] Error checking follow status:`, error)
    return false
  }
}

/**
 * Fetch user favorites from Contabo (for profile page)
 */
export async function fetchUserFavoritesFromContabo(userId: string, limit: number = 12): Promise<any[]> {
  try {
    const result = await queryContabo<{
      movie_id: number
      created_at: string
    }>(
      `SELECT movie_id, created_at
       FROM favorites
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    )

    if (result.rows.length === 0) {
      return []
    }

    const movieIds = result.rows.map(r => r.movie_id)

    // Fetch movie details
    const moviesResult = await queryContabo<{
      id: number
      title: string
      poster_url: string | null
      type: string
      rating: number | null
      release_date: string | null
      quality: string | null
    }>(
      `SELECT id, title, poster_url, type, rating, release_date, quality
       FROM movies
       WHERE id = ANY($1::bigint[])`,
      [movieIds]
    )

    return moviesResult.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching user favorites:`, error)
    return []
  }
}

/**
 * Fetch spam patterns from Contabo
 */
export async function fetchSpamPatternsFromContabo(): Promise<any[]> {
  try {
    const result = await queryContabo<{
      id: number
      pattern: string
      pattern_type: string
      severity: number
    }>(
      `SELECT id, pattern, pattern_type, severity
       FROM spam_patterns
       WHERE is_active = true`,
      []
    )
    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching spam patterns:`, error)
    return []
  }
}

/**
 * Get user profile for moderation checks from Contabo
 */
export async function getUserProfileForModerationFromContabo(userId: string): Promise<{
  is_banned: boolean
  banned_reason: string | null
  is_muted: boolean
  muted_until: string | null
  comments_approved: number
  comments_flagged: number
} | null> {
  try {
    const result = await queryContabo<{
      is_banned: boolean
      banned_reason: string | null
      is_muted: boolean
      muted_until: string | null
      comments_approved: number
      comments_flagged: number
    }>(
      `SELECT is_banned, banned_reason, is_muted, muted_until, comments_approved, comments_flagged
       FROM profiles
       WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching user profile for moderation:`, error)
    return null
  }
}

/**
 * Fetch user profile with email from Contabo (for email notifications)
 */
export async function fetchUserProfileWithEmailFromContabo(userId: string): Promise<{
  username: string
  email: string
} | null> {
  try {
    const result = await queryContabo<{
      username: string
      email: string
    }>(
      `SELECT username, email
       FROM profiles
       WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error fetching user profile with email:`, error)
    return null
  }
}

/**
 * Fetch new movies/series from the past week from Contabo (for weekly digest)
 */
export async function fetchNewContentFromPastWeekFromContabo(type: "movie" | "series", limit: number = 10): Promise<any[]> {
  try {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const result = await queryContabo<{
      id: number
      title: string
      poster_url: string | null
      type: string
      release_date: string | null
    }>(
      `SELECT id, title, poster_url, type, release_date
       FROM movies
       WHERE type = $1
       AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [type, oneWeekAgo.toISOString(), limit]
    )

    return result.rows
  } catch (error: any) {
    console.error(`[Contabo] Error fetching new content from past week:`, error)
    return []
  }
}

