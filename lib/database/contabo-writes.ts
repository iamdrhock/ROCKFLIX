/**
 * Contabo Database Write Operations
 * 
 * Helper functions for writing to Contabo PostgreSQL database
 * Used by admin import endpoints when USE_CONTABO_DB is enabled
 */

import { queryContabo } from './contabo-pool'

/**
 * Fix view_analytics sequence if out of sync
 */
async function fixViewAnalyticsSequence(): Promise<void> {
  try {
    await queryContabo(
      `SELECT setval('view_analytics_id_seq', COALESCE((SELECT MAX(id) FROM view_analytics), 0) + 1, false)`
    )
  } catch (error: any) {
    // Ignore errors - sequence might not exist or table might be empty
    console.warn(`[Contabo] Could not fix view_analytics sequence:`, error?.message)
  }
}

/**
 * Increment movie views counter in Contabo
 */
export async function incrementMovieViewsContabo(movieId: number): Promise<void> {
  try {
    await queryContabo(
      `UPDATE movies 
       SET views = COALESCE(views, 0) + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [movieId]
    )
    console.log(`[Contabo] Incremented views for movie ${movieId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error incrementing views for movie ${movieId}:`, error)
    throw error
  }
}

/**
 * Track a view event in Contabo
 */
export async function trackViewInContabo(data: {
  movie_id: number
  user_id?: string | null
  session_id: string
  view_duration?: number | null
  completion_percentage?: number | null
  player_used?: string | null
  device_type?: string | null
  browser?: string | null
}): Promise<void> {
  // Fix sequence proactively before insert
  await fixViewAnalyticsSequence()

  try {
    await queryContabo(
      `INSERT INTO view_analytics (
        movie_id, user_id, session_id, view_duration, 
        completion_percentage, player_used, device_type, browser, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        data.movie_id,
        data.user_id || null,
        data.session_id,
        data.view_duration || null,
        data.completion_percentage || null,
        data.player_used || null,
        data.device_type || null,
        data.browser || null,
      ]
    )
    console.log(`[Contabo] Tracked view for movie ${data.movie_id}`)
  } catch (error: any) {
    // Handle sequence out of sync error (shouldn't happen after proactive fix, but just in case)
    if (error?.code === '23505') {
      console.warn(`[Contabo] Duplicate key error, fixing sequence and retrying...`)
      await fixViewAnalyticsSequence()

      // Retry the insert
      try {
        await queryContabo(
          `INSERT INTO view_analytics (
            movie_id, user_id, session_id, view_duration, 
            completion_percentage, player_used, device_type, browser, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            data.movie_id,
            data.user_id || null,
            data.session_id,
            data.view_duration || null,
            data.completion_percentage || null,
            data.player_used || null,
            data.device_type || null,
            data.browser || null,
          ]
        )
        console.log(`[Contabo] Tracked view for movie ${data.movie_id} (after retry)`)
        return
      } catch (retryError: any) {
        console.error(`[Contabo] Error retrying after sequence fix:`, retryError)
        throw retryError
      }
    }

    console.error(`[Contabo] Error tracking view:`, error)
    console.error(`[Contabo] Error details:`, {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
    })
    throw error
  }
}

/**
 * Track a search event in Contabo
 */
export async function trackSearchInContabo(data: {
  query: string
  user_id?: string | null
  session_id: string
  results_count?: number | null
  clicked_result_id?: number | null
  device_type?: string | null
}): Promise<void> {
  try {
    await queryContabo(
      `INSERT INTO search_analytics (
        query, user_id, session_id, results_count, 
        clicked_result_id, device_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        data.query,
        data.user_id || null,
        data.session_id,
        data.results_count || null,
        data.clicked_result_id || null,
        data.device_type || null,
      ]
    )
    console.log(`[Contabo] Tracked search: "${data.query}"`)
  } catch (error: any) {
    console.error(`[Contabo] Error tracking search:`, error)
    throw error
  }
}

/**
 * Track a player error in Contabo
 */
export async function trackPlayerErrorInContabo(data: {
  movie_id: number
  user_id?: string | null
  session_id: string
  player_used: string
  error_type: string
  error_message?: string | null
  device_type?: string | null
  browser?: string | null
}): Promise<void> {
  try {
    await queryContabo(
      `INSERT INTO player_errors (
        movie_id, user_id, session_id, player_used, 
        error_type, error_message, device_type, browser, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        data.movie_id,
        data.user_id || null,
        data.session_id,
        data.player_used,
        data.error_type,
        data.error_message || null,
        data.device_type || null,
        data.browser || null,
      ]
    )
    console.log(`[Contabo] Tracked player error for movie ${data.movie_id}`)
  } catch (error: any) {
    console.error(`[Contabo] Error tracking player error:`, error)
    throw error
  }
}

interface MovieData {
  title: string
  description: string
  release_date: string | null
  rating: number | null
  duration: string | null
  poster_url: string | null
  backdrop_url: string | null
  trailer_url: string | null
  quality: string
  type: 'movie' | 'series'
  imdb_id: string
  tmdb_id?: string
  total_seasons: number | null
  views: number
  country: string | null
}

/**
 * Check if a movie exists by imdb_id
 */
export async function findMovieByImdbId(imdbId: string): Promise<{ id: number; title: string; type: string; poster_url: string | null; backdrop_url: string | null } | null> {
  const result = await queryContabo<{ id: number; title: string; type: string; poster_url: string | null; backdrop_url: string | null }>(
    'SELECT id, title, type, poster_url, backdrop_url FROM movies WHERE imdb_id = $1',
    [imdbId]
  )
  return result.rows[0] || null
}

/**
 * Upsert a movie (insert or update on conflict)
 */
export async function upsertMovie(data: MovieData): Promise<{ id: number }> {
  // First, check if movie exists by imdb_id
  const existing = await queryContabo<{ id: number; poster_url: string | null; backdrop_url: string | null }>(
    'SELECT id, poster_url, backdrop_url FROM movies WHERE imdb_id = $1',
    [data.imdb_id]
  )

  if (existing.rows[0]) {
    // Update existing movie - preserve existing image URLs if new ones are null/empty
    const existingPosterUrl = existing.rows[0].poster_url
    const existingBackdropUrl = existing.rows[0].backdrop_url

    // Use new image URLs if they're not null/empty, otherwise keep existing ones
    const posterUrl = data.poster_url || existingPosterUrl
    const backdropUrl = data.backdrop_url || existingBackdropUrl

    console.log(`[Contabo] Updating movie "${data.title}" (imdb_id: ${data.imdb_id})`)
    console.log(`[Contabo] Image URLs - Poster: ${posterUrl || 'null'} (was: ${existingPosterUrl || 'null'}), Backdrop: ${backdropUrl || 'null'} (was: ${existingBackdropUrl || 'null'})`)

    const result = await queryContabo<{ id: number }>(
      `UPDATE movies SET
        title = $1,
        description = $2,
        release_date = $3,
        rating = $4,
        duration = $5,
        poster_url = $6,
        backdrop_url = $7,
        trailer_url = $8,
        quality = $9,
        type = $10,
        tmdb_id = $11,
        total_seasons = $12,
        country = $13,
        updated_at = NOW()
      WHERE imdb_id = $14
      RETURNING id`,
      [
        data.title,
        data.description,
        data.release_date,
        data.rating,
        data.duration,
        posterUrl,
        backdropUrl,
        data.trailer_url,
        data.quality,
        data.type,
        data.tmdb_id || null,
        data.total_seasons,
        data.country,
        data.imdb_id,
      ]
    )
    console.log(`[Contabo] ✅ Movie updated with ID: ${result.rows[0].id}`)
    return result.rows[0]
  } else {
    // Insert new movie
    console.log(`[Contabo] Inserting new movie: "${data.title}" (imdb_id: ${data.imdb_id})`)
    const result = await queryContabo<{ id: number; created_at: string }>(
      `INSERT INTO movies (
        title, description, release_date, rating, duration,
        poster_url, backdrop_url, trailer_url, quality, type,
        imdb_id, tmdb_id, total_seasons, views, country, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING id, created_at`,
      [
        data.title,
        data.description,
        data.release_date,
        data.rating,
        data.duration,
        data.poster_url,
        data.backdrop_url,
        data.trailer_url,
        data.quality,
        data.type,
        data.imdb_id,
        data.tmdb_id || null,
        data.total_seasons,
        data.views,
        data.country,
      ]
    )
    console.log(`[Contabo] ✅ Movie inserted with ID: ${result.rows[0].id}, created_at: ${result.rows[0].created_at}`)

    // Verify the movie can be found immediately after insert
    const verify = await queryContabo<{ id: number; title: string }>(
      'SELECT id, title FROM movies WHERE id = $1',
      [result.rows[0].id]
    )
    if (verify.rows.length === 0) {
      console.error(`[Contabo] ❌ CRITICAL: Movie ${result.rows[0].id} not found immediately after insert!`)
    } else {
      console.log(`[Contabo] ✅ Verified: Movie ${result.rows[0].id} exists in database`)
    }

    return result.rows[0]
  }
}

/**
 * Find or create a country
 */
export async function findOrCreateCountry(name: string): Promise<number | null> {
  // Try to find existing
  const existing = await queryContabo<{ id: number }>(
    'SELECT id FROM countries WHERE name = $1',
    [name]
  )

  if (existing.rows[0]) {
    return existing.rows[0].id
  }

  // Create new
  const result = await queryContabo<{ id: number }>(
    'INSERT INTO countries (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    [name]
  )
  return result.rows[0]?.id || null
}

/**
 * Link movie to country
 */
export async function upsertMovieCountry(movieId: number, countryId: number): Promise<void> {
  try {
    await queryContabo(
      'INSERT INTO movie_countries (movie_id, country_id) VALUES ($1, $2) ON CONFLICT (movie_id, country_id) DO NOTHING',
      [movieId, countryId]
    )
  } catch (error: any) {
    // If it's a duplicate key error, ignore it (already exists)
    if (error?.message?.includes('duplicate key') || error?.code === '23505') {
      console.log(`[Contabo] Movie-country relationship already exists (movie_id: ${movieId}, country_id: ${countryId})`)
      return
    }
    // Otherwise, re-throw the error
    throw error
  }
}

/**
 * Find or create a genre
 */
export async function findOrCreateGenre(name: string): Promise<number | null> {
  try {
    const existing = await queryContabo<{ id: number }>(
      'SELECT id FROM genres WHERE name = $1',
      [name]
    )

    if (existing.rows[0]) {
      console.log(`[Contabo] Found existing genre ${existing.rows[0].id}: ${name}`)
      return existing.rows[0].id
    }

    const result = await queryContabo<{ id: number }>(
      'INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [name]
    )

    if (!result.rows || result.rows.length === 0) {
      console.error(`[Contabo] Failed to insert genre: ${name}`)
      return null
    }

    console.log(`[Contabo] Created new genre ${result.rows[0].id}: ${name}`)
    return result.rows[0].id
  } catch (error: any) {
    console.error(`[Contabo] Error in findOrCreateGenre for "${name}":`, error.message)
    throw error
  }
}

/**
 * Fix sequences for relationship tables to prevent duplicate key errors
 * This should be called once at the start of import operations
 */
export async function fixRelationshipSequences(): Promise<void> {
  try {
    console.log(`[Contabo] Fixing relationship table sequences...`)

    // Fix movie_genres sequence
    await queryContabo(
      `SELECT setval('movie_genres_id_seq', COALESCE((SELECT MAX(id) FROM movie_genres), 0) + 1, false)`
    )

    // Fix movie_actors sequence
    await queryContabo(
      `SELECT setval('movie_actors_id_seq', COALESCE((SELECT MAX(id) FROM movie_actors), 0) + 1, false)`
    )

    console.log(`[Contabo] ✅ Fixed relationship table sequences`)
  } catch (error: any) {
    console.warn(`[Contabo] ⚠️ Warning: Could not fix sequences:`, error.message)
    // Don't throw - this is a best-effort fix
  }
}

/**
 * Link movie to genre
 */
export async function upsertMovieGenre(movieId: number, genreId: number): Promise<void> {
  try {
    const result = await queryContabo(
      'INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2) ON CONFLICT (movie_id, genre_id) DO NOTHING',
      [movieId, genreId]
    )
    console.log(`[Contabo] ✅ Linked movie ${movieId} to genre ${genreId} (rows affected: ${result.rowCount || 0})`)

    // Verify the insert actually worked
    const verify = await queryContabo<{ id: number }>(
      'SELECT id FROM movie_genres WHERE movie_id = $1 AND genre_id = $2',
      [movieId, genreId]
    )
    if (verify.rows.length === 0) {
      console.warn(`[Contabo] ⚠️ WARNING: Genre link not found after insert! movie_id=${movieId}, genre_id=${genreId}`)
    } else {
      console.log(`[Contabo] ✅ Verified: Genre link exists in database (id: ${verify.rows[0].id})`)
    }
  } catch (error: any) {
    // Check if it's a duplicate key error on the id column (sequence issue)
    if (error.message && error.message.includes('duplicate key value violates unique constraint "movie_genres_pkey"')) {
      // This means the id sequence is out of sync - try to fix it and retry
      console.warn(`[Contabo] ⚠️ Sequence issue detected for movie_genres, attempting to fix...`)
      try {
        // Reset the sequence to the max id + 1
        await queryContabo(
          `SELECT setval('movie_genres_id_seq', COALESCE((SELECT MAX(id) FROM movie_genres), 0) + 1, false)`
        )
        console.log(`[Contabo] ✅ Fixed movie_genres sequence`)

        // Retry the insert
        const retryResult = await queryContabo(
          'INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2) ON CONFLICT (movie_id, genre_id) DO NOTHING',
          [movieId, genreId]
        )
        console.log(`[Contabo] ✅ Linked movie ${movieId} to genre ${genreId} after sequence fix (rows affected: ${retryResult.rowCount || 0})`)
      } catch (retryError: any) {
        // If retry also fails, just log and continue (don't block the import)
        console.error(`[Contabo] ❌ ERROR linking movie ${movieId} to genre ${genreId} even after sequence fix:`, retryError.message)
      }
    } else {
      // Other errors - log and throw
      console.error(`[Contabo] ❌ Error linking movie ${movieId} to genre ${genreId}:`, error.message)
      throw error
    }
  }
}

/**
 * Find or create an actor
 */
export async function findOrCreateActor(name: string, photoUrl: string | null = null): Promise<number | null> {
  try {
    const existing = await queryContabo<{ id: number; photo_url: string | null }>(
      'SELECT id, photo_url FROM actors WHERE name = $1',
      [name]
    )

    if (existing.rows[0]) {
      const actor = existing.rows[0]
      // Update photo if actor exists but has no photo and we have one
      if (!actor.photo_url && photoUrl) {
        await queryContabo(
          'UPDATE actors SET photo_url = $1 WHERE id = $2',
          [photoUrl, actor.id]
        )
        console.log(`[Contabo] Updated photo for actor ${actor.id}: ${name}`)
      }
      return actor.id
    }

    const result = await queryContabo<{ id: number }>(
      'INSERT INTO actors (name, photo_url) VALUES ($1, $2) RETURNING id',
      [name, photoUrl]
    )

    if (!result.rows || result.rows.length === 0) {
      console.error(`[Contabo] Failed to insert actor: ${name}`)
      return null
    }

    console.log(`[Contabo] Created new actor ${result.rows[0].id}: ${name}`)
    return result.rows[0].id
  } catch (error: any) {
    console.error(`[Contabo] Error in findOrCreateActor for "${name}":`, error.message)
    throw error
  }
}

/**
 * Link movie to actor
 */
export async function upsertMovieActor(movieId: number, actorId: number, characterName?: string | null): Promise<void> {
  try {
    console.log(`[Contabo] upsertMovieActor called: movieId=${movieId}, actorId=${actorId}, characterName=${characterName || 'null'}`)

    // Use ON CONFLICT directly since we have the unique constraint on (movie_id, actor_id)
    // This will INSERT if new, or UPDATE character_name if exists
    const result = await queryContabo(
      `INSERT INTO movie_actors (movie_id, actor_id, character_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (movie_id, actor_id) 
       DO UPDATE SET character_name = EXCLUDED.character_name 
       WHERE movie_actors.character_name IS NULL OR EXCLUDED.character_name IS NOT NULL`,
      [movieId, actorId, characterName || null]
    )

    console.log(`[Contabo] ✅ Linked movie ${movieId} to actor ${actorId}${characterName ? ` as "${characterName}"` : ''} (rows affected: ${result.rowCount || 0})`)
  } catch (error: any) {
    // Check if it's a duplicate key error on the id column (sequence issue)
    if (error.message && error.message.includes('duplicate key value violates unique constraint "movie_actors_pkey"')) {
      // This means the id sequence is out of sync - try to fix it and retry
      console.warn(`[Contabo] ⚠️ Sequence issue detected for movie_actors, attempting to fix...`)
      try {
        // Reset the sequence to the max id + 1
        await queryContabo(
          `SELECT setval('movie_actors_id_seq', (SELECT MAX(id) FROM movie_actors) + 1, false)`
        )
        console.log(`[Contabo] ✅ Fixed movie_actors sequence`)

        // Retry the insert
        const retryResult = await queryContabo(
          `INSERT INTO movie_actors (movie_id, actor_id, character_name) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (movie_id, actor_id) 
           DO UPDATE SET character_name = EXCLUDED.character_name`,
          [movieId, actorId, characterName || null]
        )
        console.log(`[Contabo] ✅ Linked movie ${movieId} to actor ${actorId} after sequence fix (rows affected: ${retryResult.rowCount || 0})`)
      } catch (retryError: any) {
        // If retry also fails, just log and continue (don't block the import)
        console.error(`[Contabo] ❌ ERROR linking movie ${movieId} to actor ${actorId} even after sequence fix:`, retryError.message)
      }
    } else if (error.message && error.message.includes('no unique or exclusion constraint')) {
      // If ON CONFLICT fails because constraint doesn't exist, use plain INSERT with existence check
      console.log(`[Contabo] ON CONFLICT not available (no constraint), checking existence first`)
      const existing = await queryContabo<{ id: number }>(
        'SELECT id FROM movie_actors WHERE movie_id = $1 AND actor_id = $2 LIMIT 1',
        [movieId, actorId]
      )

      if (existing.rows.length === 0) {
        const insertResult = await queryContabo(
          'INSERT INTO movie_actors (movie_id, actor_id, character_name) VALUES ($1, $2, $3)',
          [movieId, actorId, characterName || null]
        )
        console.log(`[Contabo] ✅ Linked movie ${movieId} to actor ${actorId} (plain INSERT, rows affected: ${insertResult.rowCount || 0})`)
      } else {
        // Update character_name if provided
        if (characterName !== undefined && characterName !== null) {
          await queryContabo(
            'UPDATE movie_actors SET character_name = $1 WHERE movie_id = $2 AND actor_id = $3',
            [characterName, movieId, actorId]
          )
          console.log(`[Contabo] ✅ Updated character_name for movie ${movieId} to actor ${actorId}: "${characterName}"`)
        } else {
          console.log(`[Contabo] ✅ Movie ${movieId} already linked to actor ${actorId} (skipping)`)
        }
      }
    } else {
      // Other errors - log and continue
      console.error(`[Contabo] ❌ ERROR linking movie ${movieId} to actor ${actorId}:`, error.message)
      console.error(`[Contabo] Error stack:`, error.stack)
    }
  }
}

/**
 * Delete all relationships for a movie (actors, genres, tags, countries)
 * This is used when reimporting a movie to ensure clean data
 */
export async function deleteMovieRelationships(movieId: number): Promise<void> {
  try {
    console.log(`[Contabo] deleteMovieRelationships called for movie ID: ${movieId}`)

    // Delete all relationships in parallel
    await Promise.all([
      queryContabo('DELETE FROM movie_actors WHERE movie_id = $1', [movieId]),
      queryContabo('DELETE FROM movie_genres WHERE movie_id = $1', [movieId]),
      queryContabo('DELETE FROM movie_tags WHERE movie_id = $1', [movieId]),
      queryContabo('DELETE FROM movie_countries WHERE movie_id = $1', [movieId]),
    ])

    console.log(`[Contabo] ✅ Deleted all relationships for movie ${movieId}`)
  } catch (error: any) {
    console.error(`[Contabo] ❌ ERROR deleting relationships for movie ${movieId}:`, error.message)
    throw error
  }
}

/**
 * Find or create a tag
 */
export async function findOrCreateTag(name: string, slug: string): Promise<number | null> {
  try {
    const existing = await queryContabo<{ id: number }>(
      'SELECT id FROM tags WHERE name = $1',
      [name]
    )

    if (existing.rows[0]) {
      return existing.rows[0].id
    }

    const result = await queryContabo<{ id: number }>(
      'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug RETURNING id',
      [name, slug]
    )
    return result.rows[0]?.id || null
  } catch (error: any) {
    // If it's a duplicate key error, try to fetch the existing tag
    if (error?.message?.includes('duplicate key') || error?.code === '23505') {
      console.log(`[Contabo] Tag "${name}" already exists (duplicate key), fetching existing tag...`)
      const existing = await queryContabo<{ id: number }>(
        'SELECT id FROM tags WHERE name = $1',
        [name]
      )
      return existing.rows[0]?.id || null
    }
    // Otherwise, re-throw the error
    throw error
  }
}

/**
 * Link movie to tag
 */
export async function upsertMovieTag(movieId: number, tagId: number): Promise<void> {
  try {
    await queryContabo(
      'INSERT INTO movie_tags (movie_id, tag_id) VALUES ($1, $2) ON CONFLICT (movie_id, tag_id) DO NOTHING',
      [movieId, tagId]
    )
  } catch (error: any) {
    // If it's a duplicate key error, ignore it (already exists)
    if (error?.message?.includes('duplicate key') || error?.code === '23505') {
      console.log(`[Contabo] Movie-tag relationship already exists (movie_id: ${movieId}, tag_id: ${tagId})`)
      return
    }
    // Otherwise, re-throw the error
    throw error
  }
}

/**
 * Upsert a season
 */
export async function upsertSeason(movieId: number, seasonNumber: number, title: string, episodeCount: number): Promise<{ id: number }> {
  console.log(`[Contabo] upsertSeason - movieId: ${movieId}, seasonNumber: ${seasonNumber}, title: ${title}, episodeCount: ${episodeCount}`)
  try {
    const result = await queryContabo<{ id: number }>(
      `INSERT INTO seasons (movie_id, season_number, title, episode_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (movie_id, season_number) DO UPDATE SET
         title = EXCLUDED.title,
         episode_count = EXCLUDED.episode_count
       RETURNING id`,
      [movieId, seasonNumber, title, episodeCount]
    )
    console.log(`[Contabo] upsertSeason result:`, result)
    if (!result.rows || result.rows.length === 0) {
      throw new Error(`upsertSeason returned no rows for movieId: ${movieId}, seasonNumber: ${seasonNumber}`)
    }
    return result.rows[0]
  } catch (error) {
    console.error(`[Contabo] Error in upsertSeason:`, error)
    throw error
  }
}

/**
 * Upsert an episode
 */
export async function upsertEpisode(
  seasonId: number,
  episodeNumber: number,
  title: string,
  imdbId: string | null,
  releaseDate: string | null
): Promise<void> {
  console.log(`[Contabo] upsertEpisode - seasonId: ${seasonId}, episodeNumber: ${episodeNumber}, title: ${title}`)
  try {
    await queryContabo(
      `INSERT INTO episodes (season_id, episode_number, title, imdb_id, release_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (season_id, episode_number) DO UPDATE SET
         title = EXCLUDED.title,
         imdb_id = EXCLUDED.imdb_id,
         release_date = EXCLUDED.release_date`,
      [seasonId, episodeNumber, title, imdbId, releaseDate]
    )
    console.log(`[Contabo] upsertEpisode success for seasonId: ${seasonId}, episodeNumber: ${episodeNumber}`)
  } catch (error) {
    console.error(`[Contabo] Error in upsertEpisode:`, error)
    throw error
  }
}

/**
 * User Favorites Functions
 */
/**
 * Validate and convert user ID to UUID if needed
 * Google OAuth IDs are strings, but we need UUIDs for database
 * If the ID is not a UUID, try to look it up in the users table
 */
async function validateUserId(userId: string): Promise<string | null> {
  // Check if it's already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(userId)) {
    return userId
  }

  // If it's not a UUID (e.g., Google OAuth ID), try to find the UUID in users table
  // This happens when a user is logged in with an old token that has the OAuth ID
  console.warn(`[Contabo] User ID is not a UUID format: ${userId}, looking up UUID from users table...`)
  try {
    // Try to find user by looking in accounts table for the providerAccountId
    const accountResult = await queryContabo<{ userId: string }>(
      `SELECT "userId" FROM accounts WHERE "providerAccountId" = $1 AND provider = 'google' LIMIT 1`,
      [userId]
    )

    if (accountResult.rows.length > 0 && accountResult.rows[0].userId) {
      const foundUserId = accountResult.rows[0].userId
      console.log(`[Contabo] ✅ Found UUID for OAuth ID ${userId}: ${foundUserId}`)
      return foundUserId
    }

    // If accounts table uses snake_case
    const accountResultSnake = await queryContabo<{ user_id: string }>(
      `SELECT user_id FROM accounts WHERE provider_account_id = $1 AND provider = 'google' LIMIT 1`,
      [userId]
    )

    if (accountResultSnake.rows.length > 0 && accountResultSnake.rows[0].user_id) {
      const foundUserId = accountResultSnake.rows[0].user_id
      console.log(`[Contabo] ✅ Found UUID for OAuth ID ${userId}: ${foundUserId}`)
      return foundUserId
    }

    console.error(`[Contabo] ❌ Could not find UUID for OAuth ID: ${userId}`)
    return null
  } catch (error) {
    console.error(`[Contabo] ❌ Error looking up UUID for user ID ${userId}:`, error)
    return null
  }
}

export async function getFavoritesFromContabo(userId: string): Promise<any[]> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot get favorites: Invalid user ID format: ${userId}`)
    return []
  }

  const sql = `
    SELECT 
      f.movie_id,
      m.id,
      m.title,
      m.poster_url,
      m.release_date,
      m.rating,
      m.type,
      m.quality,
      m.imdb_id
    FROM favorites f
    INNER JOIN movies m ON f.movie_id = m.id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
  `
  const result = await queryContabo<any>(sql, [validUserId])
  return result.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    poster_url: row.poster_url,
    release_date: row.release_date,
    rating: row.rating,
    type: row.type,
    quality: row.quality,
    imdb_id: row.imdb_id,
  }))

}

export async function checkFavoriteFromContabo(userId: string, movieId: number): Promise<boolean> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot check favorite: Invalid user ID format: ${userId}`)
    return false
  }

  const sql = `SELECT id FROM favorites WHERE user_id = $1 AND movie_id = $2 LIMIT 1`
  const result = await queryContabo<{ id: number }>(sql, [validUserId, movieId])
  return result.rows.length > 0
}

export async function addFavoriteToContabo(userId: string, movieId: number): Promise<void> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot add favorite: Invalid user ID format: ${userId}`)
    throw new Error(`Invalid user ID format: ${userId}. Could not find UUID for this user.`)
  }

  await queryContabo(
    'INSERT INTO favorites (user_id, movie_id) VALUES ($1, $2) ON CONFLICT (user_id, movie_id) DO NOTHING',
    [validUserId, movieId]
  )
}

export async function removeFavoriteFromContabo(userId: string, movieId: number): Promise<void> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot remove favorite: Invalid user ID format: ${userId}`)
    throw new Error(`Invalid user ID format: ${userId}. Could not find UUID for this user.`)
  }

  await queryContabo(
    'DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2',
    [validUserId, movieId]
  )
}

/**
 * User Watchlist Functions
 */
export async function getWatchlistFromContabo(userId: string): Promise<any[]> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot get watchlist: Invalid user ID format: ${userId}`)
    return []
  }

  const sql = `
    SELECT 
      w.id,
      w.movie_id,
      w.created_at,
      m.id as movie_id,
      m.title,
      m.poster_url,
      m.type,
      m.rating,
      m.release_date,
      m.quality,
      m.imdb_id
    FROM watchlist w
    INNER JOIN movies m ON w.movie_id = m.id
    WHERE w.user_id = $1
    ORDER BY w.created_at DESC
  `
  const result = await queryContabo<any>(sql, [validUserId])
  return result.rows.map((row: any) => ({
    id: row.id,
    movie_id: row.movie_id,
    created_at: row.created_at,
    movies: {
      id: row.movie_id,
      title: row.title,
      poster_url: row.poster_url,
      type: row.type,
      rating: row.rating,
      release_date: row.release_date,
      quality: row.quality,
      imdb_id: row.imdb_id,
    },
  }))
}

export async function checkWatchlistFromContabo(userId: string, movieId: number): Promise<boolean> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot check watchlist: Invalid user ID format: ${userId}`)
    return false
  }

  const sql = `SELECT id FROM watchlist WHERE user_id = $1 AND movie_id = $2 LIMIT 1`
  const result = await queryContabo<{ id: number }>(sql, [validUserId, movieId])
  return result.rows.length > 0
}

export async function addToWatchlistContabo(userId: string, movieId: number): Promise<any> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot add to watchlist: Invalid user ID format: ${userId}`)
    throw new Error(`Invalid user ID format: ${userId}. Could not find UUID for this user.`)
  }
  const result = await queryContabo<{ id: number; user_id: string; movie_id: number; created_at: string }>(
    `INSERT INTO watchlist (user_id, movie_id) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id, movie_id) DO UPDATE SET created_at = NOW()
     RETURNING id, user_id, movie_id, created_at`,
    [validUserId, movieId]
  )
  return result.rows[0]
}

export async function removeFromWatchlistContabo(userId: string, movieId: number): Promise<void> {
  // Validate and convert user ID to UUID if needed
  const validUserId = await validateUserId(userId)
  if (!validUserId) {
    console.error(`[Contabo] Cannot remove from watchlist: Invalid user ID format: ${userId}`)
    throw new Error(`Invalid user ID format: ${userId}. Could not find UUID for this user.`)
  }
  await queryContabo(
    'DELETE FROM watchlist WHERE user_id = $1 AND movie_id = $2',
    [validUserId, movieId]
  )
}

/**
 * Comments Functions
 */
export async function addCommentToContabo(
  movieId: number,
  userId: string,
  userName: string,
  commentText: string,
  isSpam: boolean = false,
  spamScore: number = 0,
  moderationStatus: string = 'approved'
): Promise<any> {
  try {
    console.log(`[Contabo] Adding comment: movieId=${movieId}, userId=${userId}, userName=${userName}`)
    const result = await queryContabo<{
      id: number
      movie_id: number
      user_id: string
      user_name: string
      comment_text: string
      created_at: string
    }>(
      `INSERT INTO comments (movie_id, user_id, user_name, comment_text, is_spam, spam_score, moderation_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, movie_id, user_id, user_name, comment_text, created_at`,
      [movieId, userId, userName, commentText, isSpam, spamScore, moderationStatus]
    )

    if (!result.rows || result.rows.length === 0) {
      throw new Error("Comment insert returned no rows")
    }

    console.log(`[Contabo] Comment added successfully: id=${result.rows[0].id}`)
    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error adding comment:`, error)
    throw error
  }
}

export async function getProfileFromContabo(userId: string): Promise<{ username?: string } | null> {
  try {
    const result = await queryContabo<{ username?: string }>(
      'SELECT username FROM profiles WHERE id = $1',
      [userId]
    )
    return result.rows[0] || null
  } catch (error: any) {
    console.error(`[Contabo] Error fetching profile for user ${userId}:`, error)
    // Return null instead of throwing - we can fall back to email
    return null
  }
}

export async function incrementProfileFieldContabo(
  userId: string,
  fieldName: string
): Promise<void> {
  // Whitelist allowed field names to prevent SQL injection
  const allowedFields = ['comments_posted', 'comments_approved', 'comments_flagged']
  if (!allowedFields.includes(fieldName)) {
    throw new Error(`Invalid field name: ${fieldName}`)
  }

  // Use parameterized query with proper column name validation
  await queryContabo(
    `UPDATE profiles 
     SET ${fieldName} = COALESCE(${fieldName}, 0) + 1
     WHERE id = $1`,
    [userId]
  )
}

/**
 * Update comment moderation status in Contabo
 */
export async function updateCommentModerationInContabo(
  commentId: string,
  updates: {
    moderation_status?: string
    is_flagged?: boolean
    is_spam?: boolean
    flagged_by?: string | null
    flagged_at?: string | null
    flagged_reason?: string | null
    moderated_by?: string
    moderated_at?: string
  }
): Promise<void> {
  try {
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (updates.moderation_status !== undefined) {
      updateFields.push(`moderation_status = $${paramIndex++}`)
      values.push(updates.moderation_status)
    }
    if (updates.is_flagged !== undefined) {
      updateFields.push(`is_flagged = $${paramIndex++}`)
      values.push(updates.is_flagged)
    }
    if (updates.is_spam !== undefined) {
      updateFields.push(`is_spam = $${paramIndex++}`)
      values.push(updates.is_spam)
    }
    if (updates.flagged_by !== undefined) {
      updateFields.push(`flagged_by = $${paramIndex++}`)
      values.push(updates.flagged_by)
    }
    if (updates.flagged_at !== undefined) {
      updateFields.push(`flagged_at = $${paramIndex++}`)
      values.push(updates.flagged_at)
    }
    if (updates.flagged_reason !== undefined) {
      updateFields.push(`flagged_reason = $${paramIndex++}`)
      values.push(updates.flagged_reason)
    }
    if (updates.moderated_by !== undefined) {
      updateFields.push(`moderated_by = $${paramIndex++}`)
      values.push(updates.moderated_by)
    }
    if (updates.moderated_at !== undefined) {
      updateFields.push(`moderated_at = $${paramIndex++}`)
      values.push(updates.moderated_at)
    }

    if (updateFields.length === 0) {
      return // No updates to make
    }

    values.push(commentId) // For WHERE clause
    const sql = `UPDATE comments SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`

    await queryContabo(sql, values)
    console.log(`[Contabo] Updated comment moderation for comment ${commentId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error updating comment moderation:`, error)
    throw error
  }
}

/**
 * Delete comment from Contabo
 */
export async function deleteCommentFromContabo(commentId: string): Promise<void> {
  try {
    await queryContabo('DELETE FROM comments WHERE id = $1', [commentId])
    console.log(`[Contabo] Deleted comment ${commentId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error deleting comment:`, error)
    throw error
  }
}

/**
 * Update user reputation in Contabo
 */
export async function updateUserReputationInContabo(userId: string): Promise<void> {
  try {
    const result = await queryContabo<{ comments_approved: number; comments_flagged: number }>(
      'SELECT comments_approved, comments_flagged FROM profiles WHERE id = $1',
      [userId]
    )

    if (result.rows.length > 0) {
      const profile = result.rows[0]
      const reputationScore = (profile.comments_approved || 0) * 10 - (profile.comments_flagged || 0) * 20

      await queryContabo(
        'UPDATE profiles SET reputation_score = $1 WHERE id = $2',
        [reputationScore, userId]
      )
      console.log(`[Contabo] Updated reputation for user ${userId}: ${reputationScore}`)
    }
  } catch (error: any) {
    console.error(`[Contabo] Error updating user reputation:`, error)
    throw error
  }
}

/**
 * Log moderation action in Contabo
 */
export async function logModerationActionInContabo(
  moderatorId: string,
  action: string,
  targetType: "user" | "comment",
  targetId: string,
  reason: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await queryContabo(
      `INSERT INTO moderation_logs (moderator_id, action, target_type, target_id, reason, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        moderatorId,
        action,
        targetType,
        targetId,
        reason,
        details ? JSON.stringify(details) : null,
        new Date().toISOString()
      ]
    )
    console.log(`[Contabo] Logged moderation action: ${action} on ${targetType} ${targetId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error logging moderation action:`, error)
    // Don't throw - logging failures shouldn't break moderation
  }
}

/**
 * Update TalkFlix report status in Contabo
 */
export async function updateTalkFlixReportInContabo(
  reportId: string,
  status: string,
  resolutionNotes?: string
): Promise<void> {
  try {
    await queryContabo(
      `UPDATE user_reports 
       SET status = $1, resolution_notes = $2, reviewed_at = $3 
       WHERE id = $4`,
      [status, resolutionNotes || null, new Date().toISOString(), reportId]
    )
    console.log(`[Contabo] Updated report ${reportId} to status: ${status}`)
  } catch (error: any) {
    console.error(`[Contabo] Error updating TalkFlix report:`, error)
    throw error
  }
}

/**
 * Add download link to Contabo
 */
export async function addDownloadLinkToContabo(
  movieId: number,
  quality: string,
  linkUrl: string,
  format: string = "MP4",
  provider: string = "",
  fileSize: string = "",
  uploadedBy: string = "admin",
  episodeId?: number | null
): Promise<any> {
  try {
    const { queryContabo } = await import('./contabo-pool')

    // Build SQL with proper handling of episode_id
    const sql = `
      INSERT INTO download_links (
        movie_id,
        episode_id,
        quality,
        format,
        link_url,
        provider,
        file_size,
        uploaded_by,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `

    const params = [
      movieId,
      episodeId || null,
      quality,
      format || "MP4",
      linkUrl,
      provider || "",
      fileSize || "",
      uploadedBy || "admin",
      'active'
    ]

    console.log(`[Contabo] Inserting download link:`, { movieId, episodeId, quality, format, linkUrl, provider })

    const result = await queryContabo<any>(sql, params)

    if (result.rows.length === 0) {
      throw new Error('Failed to insert download link - no rows returned')
    }

    console.log(`[Contabo] Successfully added download link for movie ${movieId}${episodeId ? `, episode ${episodeId}` : ''}, quality: ${quality}`)
    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error adding download link:`, error)
    console.error(`[Contabo] Error details:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    })
    throw error
  }
}

/**
 * Update download link in Contabo
 */
export async function updateDownloadLinkInContabo(
  id: number,
  updates: {
    quality?: string
    format?: string
    link_url?: string
    provider?: string
    file_size?: string
    status?: string
  }
): Promise<any> {
  try {
    const { queryContabo } = await import('./contabo-pool')

    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (updates.quality !== undefined) {
      updateFields.push(`quality = $${paramIndex++}`)
      values.push(updates.quality)
    }
    if (updates.format !== undefined) {
      updateFields.push(`format = $${paramIndex++}`)
      values.push(updates.format)
    }
    if (updates.link_url !== undefined) {
      updateFields.push(`link_url = $${paramIndex++}`)
      values.push(updates.link_url)
    }
    if (updates.provider !== undefined) {
      updateFields.push(`provider = $${paramIndex++}`)
      values.push(updates.provider)
    }
    if (updates.file_size !== undefined) {
      updateFields.push(`file_size = $${paramIndex++}`)
      values.push(updates.file_size)
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`)
      values.push(updates.status)
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update')
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`)

    // Add id to values for WHERE clause
    values.push(id)
    const idParamIndex = paramIndex

    const sql = `
      UPDATE download_links 
      SET ${updateFields.join(', ')} 
      WHERE id = $${idParamIndex} 
      RETURNING *
    `

    console.log(`[Contabo] Updating download link ${id} with fields:`, updateFields)

    const result = await queryContabo<any>(sql, values)

    if (result.rows.length === 0) {
      throw new Error('Download link not found')
    }

    console.log(`[Contabo] Successfully updated download link ${id}`)
    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error updating download link:`, error)
    throw error
  }
}

/**
 * Delete download link from Contabo
 */
export async function deleteDownloadLinkFromContabo(id: number): Promise<void> {
  try {
    const { queryContabo } = await import('./contabo-pool')

    const sql = `DELETE FROM download_links WHERE id = $1 RETURNING id`

    console.log(`[Contabo] Deleting download link ${id}`)

    const result = await queryContabo<{ id: number }>(sql, [id])

    if (result.rows.length === 0) {
      throw new Error('Download link not found')
    }

    console.log(`[Contabo] Successfully deleted download link ${id}`)
  } catch (error: any) {
    console.error(`[Contabo] Error deleting download link:`, error)
    throw error
  }
}

/**
 * Add blog post to Contabo
 */
export async function addBlogPostToContabo(
  title: string,
  slug: string,
  body: string,
  featuredImageUrl?: string | null,
  published: boolean = false
): Promise<any> {
  try {
    const { queryContabo } = await import('./contabo-pool')

    const sql = `
      INSERT INTO blog_posts (
        title,
        slug,
        body,
        featured_image_url,
        published,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `

    const params = [
      title,
      slug,
      body,
      featuredImageUrl || null,
      published
    ]

    const result = await queryContabo<any>(sql, params)

    if (result.rows.length === 0) {
      throw new Error('Failed to insert blog post')
    }

    console.log(`[Contabo] Added blog post: ${title} (slug: ${slug})`)
    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error adding blog post:`, error)
    throw error
  }
}

/**
 * Update blog post in Contabo
 */
export async function updateBlogPostInContabo(
  id: number,
  title: string,
  slug: string,
  body: string,
  featuredImageUrl?: string | null,
  published?: boolean
): Promise<any> {
  try {
    console.log(`[Contabo] 🚀 updateBlogPostInContabo called:`, {
      id,
      title,
      slug,
      bodyLength: body?.length,
      featuredImageUrl,
      published
    })

    const { queryContabo } = await import('./contabo-pool')

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    updates.push(`title = $${paramIndex++}`)
    params.push(title)

    updates.push(`slug = $${paramIndex++}`)
    params.push(slug)

    updates.push(`body = $${paramIndex++}`)
    params.push(body)

    if (featuredImageUrl !== undefined) {
      updates.push(`featured_image_url = $${paramIndex++}`)
      params.push(featuredImageUrl || null)
    }

    if (published !== undefined) {
      updates.push(`published = $${paramIndex++}`)
      params.push(published)
    }

    updates.push(`updated_at = NOW()`)

    params.push(id)

    const sql = `
      UPDATE blog_posts
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    console.log(`[Contabo] 📝 Executing SQL:`, {
      sql: sql.replace(/\s+/g, ' ').trim(),
      paramCount: params.length,
      params: params.map((p, i) => ({
        index: i + 1,
        type: typeof p,
        value: typeof p === 'string' ? p.substring(0, 50) + (p.length > 50 ? '...' : '') : p
      }))
    })

    const result = await queryContabo<any>(sql, params)

    console.log(`[Contabo] 📊 Query result:`, {
      hasResult: !!result,
      hasRows: !!result?.rows,
      rowCount: result?.rows?.length
    })

    if (!result || !result.rows || result.rows.length === 0) {
      console.error(`[Contabo] ❌ Blog post update returned no rows for id: ${id}`)
      throw new Error(`Blog post not found or update failed for id: ${id}`)
    }

    const updatedPost = result.rows[0]
    console.log(`[Contabo] ✅ Updated blog post: ${id}`, {
      id: updatedPost.id,
      title: updatedPost.title,
      slug: updatedPost.slug,
      bodyLength: updatedPost.body?.length,
      published: updatedPost.published,
      updatedAt: updatedPost.updated_at
    })
    return updatedPost
  } catch (error: any) {
    console.error(`[Contabo] ❌ Error updating blog post:`, {
      id,
      error: error.message,
      stack: error.stack,
      code: error.code
    })
    throw error
  }
}

/**
 * Add custom page to Contabo
 */
export async function addCustomPageToContabo(
  title: string,
  slug: string,
  content: string,
  featuredImageUrl?: string | null,
  published: boolean = false
): Promise<any> {
  try {
    const { queryContabo } = await import('./contabo-pool')

    const sql = `
      INSERT INTO custom_pages (
        title,
        slug,
        content,
        featured_image_url,
        published,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `

    const params = [
      title,
      slug.toLowerCase().replace(/\s+/g, "-"),
      content,
      featuredImageUrl || null,
      published
    ]

    const result = await queryContabo<any>(sql, params)

    if (result.rows.length === 0) {
      throw new Error('Failed to insert custom page')
    }

    console.log(`[Contabo] Added custom page: ${title} (slug: ${slug})`)
    return result.rows[0]
  } catch (error: any) {
    console.error(`[Contabo] Error adding custom page:`, error)
    throw error
  }
}

/**
 * Update custom page in Contabo
 */
export async function updateCustomPageInContabo(
  id: number,
  title: string,
  slug: string,
  content: string,
  featuredImageUrl?: string | null,
  published?: boolean
): Promise<any> {
  try {
    console.log(`[Contabo] 🚀 updateCustomPageInContabo called:`, {
      id,
      title,
      slug,
      contentLength: content?.length,
      featuredImageUrl,
      published
    })

    const { queryContabo } = await import('./contabo-pool')

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    updates.push(`title = $${paramIndex++}`)
    params.push(title)

    const normalizedSlug = slug.toLowerCase().replace(/\s+/g, "-")
    updates.push(`slug = $${paramIndex++}`)
    params.push(normalizedSlug)

    updates.push(`content = $${paramIndex++}`)
    params.push(content)

    if (featuredImageUrl !== undefined) {
      updates.push(`featured_image_url = $${paramIndex++}`)
      params.push(featuredImageUrl || null)
    }

    if (published !== undefined) {
      updates.push(`published = $${paramIndex++}`)
      params.push(published)
    }

    updates.push(`updated_at = NOW()`)

    params.push(id)

    const sql = `
      UPDATE custom_pages
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    console.log(`[Contabo] 📝 Executing SQL:`, {
      sql: sql.replace(/\s+/g, ' ').trim(),
      paramCount: params.length,
      params: params.map((p, i) => ({
        index: i + 1,
        type: typeof p,
        value: typeof p === 'string' ? p.substring(0, 50) + (p.length > 50 ? '...' : '') : p
      }))
    })

    const result = await queryContabo<any>(sql, params)

    console.log(`[Contabo] 📊 Query result:`, {
      hasResult: !!result,
      hasRows: !!result?.rows,
      rowCount: result?.rows?.length
    })

    if (!result || !result.rows || result.rows.length === 0) {
      console.error(`[Contabo] ❌ Custom page update returned no rows for id: ${id}`)
      throw new Error(`Custom page not found or update failed for id: ${id}`)
    }

    const updatedPage = result.rows[0]
    console.log(`[Contabo] ✅ Updated custom page: ${id}`, {
      id: updatedPage.id,
      title: updatedPage.title,
      slug: updatedPage.slug,
      contentLength: updatedPage.content?.length,
      published: updatedPage.published,
      updatedAt: updatedPage.updated_at
    })
    return updatedPage
  } catch (error: any) {
    console.error(`[Contabo] ❌ Error updating custom page:`, {
      id,
      error: error.message,
      stack: error.stack,
      code: error.code
    })
    throw error
  }
}

/**
 * Update user profile in Contabo
 */
export async function updateUserInContabo(
  userId: string,
  updates: {
    is_banned?: boolean
    banned_at?: string | null
    banned_reason?: string | null
    role?: string
    is_muted?: boolean
    muted_until?: string | null
    muted_reason?: string | null
  }
): Promise<void> {
  try {
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (updates.is_banned !== undefined) {
      updateFields.push(`is_banned = $${paramIndex++}`)
      values.push(updates.is_banned)
    }
    if (updates.banned_at !== undefined) {
      updateFields.push(`banned_at = $${paramIndex++}`)
      values.push(updates.banned_at)
    }
    if (updates.banned_reason !== undefined) {
      updateFields.push(`banned_reason = $${paramIndex++}`)
      values.push(updates.banned_reason)
    }
    if (updates.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`)
      values.push(updates.role)
    }
    if (updates.is_muted !== undefined) {
      updateFields.push(`is_muted = $${paramIndex++}`)
      values.push(updates.is_muted)
    }
    if (updates.muted_until !== undefined) {
      updateFields.push(`muted_until = $${paramIndex++}`)
      values.push(updates.muted_until)
    }
    if (updates.muted_reason !== undefined) {
      updateFields.push(`muted_reason = $${paramIndex++}`)
      values.push(updates.muted_reason)
    }

    if (updateFields.length === 0) {
      return // No updates to make
    }

    values.push(userId) // For WHERE clause
    const sql = `UPDATE profiles SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`

    await queryContabo(sql, values)
    console.log(`[Contabo] Updated user ${userId} with fields:`, Object.keys(updates))
  } catch (error: any) {
    console.error(`[Contabo] Error updating user:`, error)
    throw error
  }
}

/**
 * Delete user profile from Contabo
 * Note: This only deletes from profiles table. Auth user deletion should be handled separately.
 */
export async function deleteUserFromContabo(userId: string): Promise<void> {
  try {
    // Delete related records first (CASCADE should handle most, but explicit is safer)
    await queryContabo('DELETE FROM favorites WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM watchlist WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM comments WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM post_likes WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM post_comments WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM post_reposts WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM bookmarks WHERE user_id = $1', [userId])
    await queryContabo('DELETE FROM user_follows WHERE follower_id = $1 OR following_id = $1', [userId])

    // Delete the profile
    await queryContabo('DELETE FROM profiles WHERE id = $1', [userId])
    console.log(`[Contabo] Deleted user profile ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error deleting user:`, error)
    throw error
  }
}

/**
 * Create a post in Contabo with hashtags and movie links
 */
export async function createPostInContabo(data: {
  user_id: string
  content: string
  youtube_url?: string | null
  image_url?: string | null
  movie_id?: number | null
  hashtags?: string[]
}): Promise<any> {
  try {
    // Insert post
    const postResult = await queryContabo<{ id: number; user_id: string; content: string; youtube_url: string | null; image_url: string | null; likes_count: number; comments_count: number; repost_count: number; created_at: string; updated_at: string }>(
      `INSERT INTO posts (user_id, content, youtube_url, image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, user_id, content, youtube_url, image_url, likes_count, comments_count, repost_count, created_at, updated_at`,
      [
        data.user_id,
        data.content,
        data.youtube_url || null,
        data.image_url || null,
      ]
    )

    const post = postResult.rows[0]
    if (!post) {
      throw new Error('Failed to create post')
    }

    // Link movie if provided
    if (data.movie_id) {
      try {
        await queryContabo(
          `INSERT INTO post_movies (post_id, movie_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (post_id, movie_id) DO NOTHING`,
          [post.id, data.movie_id]
        )
      } catch (error: any) {
        console.error(`[Contabo] Error linking movie to post:`, error)
        // Don't fail the whole operation if movie link fails
      }
    }

    // Process hashtags
    const processedHashtags: string[] = []
    if (data.hashtags && data.hashtags.length > 0) {
      for (const tag of data.hashtags) {
        try {
          // Find or create hashtag
          let hashtagResult = await queryContabo<{ id: number }>(
            'SELECT id FROM hashtags WHERE name = $1',
            [tag.toLowerCase()]
          )

          let hashtagId: number
          if (hashtagResult.rows.length === 0) {
            // Create new hashtag
            const newHashtagResult = await queryContabo<{ id: number }>(
              `INSERT INTO hashtags (name, created_at)
               VALUES ($1, NOW())
               RETURNING id`,
              [tag.toLowerCase()]
            )
            hashtagId = newHashtagResult.rows[0].id
          } else {
            hashtagId = hashtagResult.rows[0].id
          }

          // Link hashtag to post
          await queryContabo(
            `INSERT INTO post_hashtags (post_id, hashtag_id, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (post_id, hashtag_id) DO NOTHING`,
            [post.id, hashtagId]
          )

          processedHashtags.push(tag)
        } catch (error: any) {
          console.error(`[Contabo] Error processing hashtag "${tag}":`, error)
          // Continue with other hashtags
        }
      }
    }

    // Fetch user profile
    const profileResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      'SELECT id, username, profile_picture_url FROM profiles WHERE id = $1',
      [data.user_id]
    )
    const profile = profileResult.rows[0] || null

    // Fetch movie data if linked
    let movieData: any[] = []
    if (data.movie_id) {
      const movieResult = await queryContabo<{ id: number; title: string; poster_url: string | null; type: string }>(
        'SELECT id, title, poster_url, type FROM movies WHERE id = $1',
        [data.movie_id]
      )
      if (movieResult.rows.length > 0) {
        movieData = [movieResult.rows[0]]
      }
    }

    return {
      ...post,
      profiles: profile,
      isLiked: false,
      hashtags: processedHashtags,
      post_movies: movieData,
      post_likes: undefined,
    }
  } catch (error: any) {
    console.error(`[Contabo] Error creating post:`, error)
    throw error
  }
}

/**
 * Update notification read status in Contabo
 */
export async function updateNotificationsReadStatusInContabo(
  userId: string,
  notificationIds: number[],
  markAsRead: boolean
): Promise<void> {
  try {
    if (notificationIds.length === 0) {
      return
    }

    await queryContabo(
      `UPDATE talkflix_notifications 
       SET read = $1 
       WHERE user_id = $2 AND id = ANY($3::bigint[])`,
      [markAsRead, userId, notificationIds]
    )
    console.log(`[Contabo] Updated ${notificationIds.length} notifications for user ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error updating notifications:`, error)
    throw error
  }
}

/**
 * Like a post in Contabo
 */
export async function likePostInContabo(postId: number, userId: string): Promise<any> {
  try {
    const result = await queryContabo<{ id: number; post_id: number; user_id: string; created_at: string }>(
      `INSERT INTO post_likes (post_id, user_id, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, post_id, user_id, created_at`,
      [postId, userId]
    )
    console.log(`[Contabo] Liked post ${postId} by user ${userId}`)
    return result.rows[0]
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique constraint violation - already liked
      throw new Error('Already liked')
    }
    console.error(`[Contabo] Error liking post:`, error)
    throw error
  }
}

/**
 * Unlike a post in Contabo
 */
export async function unlikePostInContabo(postId: number, userId: string): Promise<void> {
  try {
    await queryContabo(
      `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    )
    console.log(`[Contabo] Unliked post ${postId} by user ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error unliking post:`, error)
    throw error
  }
}

/**
 * Create a post comment in Contabo
 */
export async function createPostCommentInContabo(data: {
  postId: number
  userId: string
  content: string
  parentCommentId?: number | null
}): Promise<any> {
  try {
    const result = await queryContabo<{
      id: number
      post_id: number
      user_id: string
      content: string
      parent_comment_id: number | null
      likes_count: number
      dislikes_count: number
      created_at: string
    }>(
      `INSERT INTO post_comments (post_id, user_id, content, parent_comment_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, post_id, user_id, content, parent_comment_id, likes_count, dislikes_count, created_at`,
      [data.postId, data.userId, data.content, data.parentCommentId || null]
    )

    const comment = result.rows[0]
    if (!comment) {
      throw new Error('Failed to create comment')
    }

    // Fetch user profile
    const profileResult = await queryContabo<{ id: string; username: string; profile_picture_url: string | null }>(
      'SELECT id, username, profile_picture_url FROM profiles WHERE id = $1',
      [data.userId]
    )
    const profile = profileResult.rows[0] || null

    return {
      ...comment,
      profiles: profile,
      replies: [],
    }
  } catch (error: any) {
    console.error(`[Contabo] Error creating comment:`, error)
    throw error
  }
}

/**
 * Repost or unrepost a post in Contabo
 */
export async function toggleRepostInContabo(
  postId: number,
  userId: string,
  quoteContent?: string | null
): Promise<{ reposted: boolean; message: string }> {
  try {
    // Check if already reposted
    const existingResult = await queryContabo<{ id: number }>(
      `SELECT id FROM post_reposts WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    )

    if (existingResult.rows.length > 0) {
      // Un-repost
      await queryContabo(
        `DELETE FROM post_reposts WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      )
      console.log(`[Contabo] Un-reposted post ${postId} by user ${userId}`)
      return { reposted: false, message: 'Repost removed' }
    } else {
      // Create repost
      await queryContabo(
        `INSERT INTO post_reposts (post_id, user_id, quote_content, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [postId, userId, quoteContent || null]
      )
      console.log(`[Contabo] Reposted post ${postId} by user ${userId}`)
      return {
        reposted: true,
        message: quoteContent ? 'Quote posted successfully' : 'Reposted successfully',
      }
    }
  } catch (error: any) {
    console.error(`[Contabo] Error toggling repost:`, error)
    throw error
  }
}

/**
 * Check if post is reposted by user in Contabo
 */
export async function checkRepostStatusInContabo(postId: number, userId: string): Promise<boolean> {
  try {
    const result = await queryContabo<{ id: number }>(
      `SELECT id FROM post_reposts WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    )
    return result.rows.length > 0
  } catch (error: any) {
    console.error(`[Contabo] Error checking repost status:`, error)
    return false
  }
}

/**
 * Create a bookmark in Contabo
 */
export async function createBookmarkInContabo(postId: number, userId: string): Promise<any> {
  try {
    const result = await queryContabo<{ id: number; post_id: number; user_id: string; created_at: string }>(
      `INSERT INTO bookmarks (post_id, user_id, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, post_id, user_id, created_at`,
      [postId, userId]
    )
    console.log(`[Contabo] Bookmarked post ${postId} by user ${userId}`)
    return result.rows[0]
  } catch (error: any) {
    if (error.code === '23505') {
      // Already bookmarked
      throw new Error('Already bookmarked')
    }
    console.error(`[Contabo] Error creating bookmark:`, error)
    throw error
  }
}

/**
 * Delete a bookmark in Contabo
 */
export async function deleteBookmarkInContabo(postId: number, userId: string): Promise<void> {
  try {
    await queryContabo(
      `DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    )
    console.log(`[Contabo] Deleted bookmark for post ${postId} by user ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error deleting bookmark:`, error)
    throw error
  }
}

/**
 * Check if post is bookmarked by user in Contabo
 */
export async function checkBookmarkStatusInContabo(postId: number, userId: string): Promise<boolean> {
  try {
    const result = await queryContabo<{ id: number }>(
      `SELECT id FROM bookmarks WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    )
    return result.rows.length > 0
  } catch (error: any) {
    console.error(`[Contabo] Error checking bookmark status:`, error)
    return false
  }
}

/**
 * Follow a user in Contabo
 */
export async function followUserInContabo(followerId: string, followingId: string): Promise<void> {
  try {
    await queryContabo(
      `INSERT INTO user_follows (follower_id, following_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [followerId, followingId]
    )
    console.log(`[Contabo] User ${followerId} followed ${followingId}`)
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('Already following')
    }
    console.error(`[Contabo] Error following user:`, error)
    throw error
  }
}

/**
 * Unfollow a user in Contabo
 */
export async function unfollowUserInContabo(followerId: string, followingId: string): Promise<void> {
  try {
    await queryContabo(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    )
    console.log(`[Contabo] User ${followerId} unfollowed ${followingId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error unfollowing user:`, error)
    throw error
  }
}

/**
 * Like or dislike a comment in Contabo
 */
export async function toggleCommentLikeInContabo(
  commentId: number,
  userId: string,
  isLike: boolean
): Promise<{ action: string }> {
  try {
    // Check if user already reacted
    const existingResult = await queryContabo<{ id: number; is_like: boolean }>(
      `SELECT id, is_like FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId]
    )

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0]
      if (existing.is_like === isLike) {
        // Same reaction - remove it
        await queryContabo(
          `DELETE FROM comment_likes WHERE id = $1`,
          [existing.id]
        )
        console.log(`[Contabo] Removed comment reaction ${commentId} by user ${userId}`)
        return { action: 'removed' }
      } else {
        // Different reaction - update it
        await queryContabo(
          `UPDATE comment_likes SET is_like = $1 WHERE id = $2`,
          [isLike, existing.id]
        )
        console.log(`[Contabo] Updated comment reaction ${commentId} by user ${userId}`)
        return { action: 'updated' }
      }
    } else {
      // No existing reaction - create new one
      await queryContabo(
        `INSERT INTO comment_likes (comment_id, user_id, is_like, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [commentId, userId, isLike]
      )
      console.log(`[Contabo] Added comment reaction ${commentId} by user ${userId}`)
      return { action: 'added' }
    }
  } catch (error: any) {
    console.error(`[Contabo] Error toggling comment like:`, error)
    throw error
  }
}

/**
 * Follow a series in Contabo
 */
export async function followSeriesInContabo(userId: string, seriesId: number): Promise<any> {
  try {
    const result = await queryContabo<{ id: number; user_id: string; series_id: number; created_at: string }>(
      `INSERT INTO series_followers (user_id, series_id, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, user_id, series_id, created_at`,
      [userId, seriesId]
    )
    console.log(`[Contabo] User ${userId} followed series ${seriesId}`)
    return result.rows[0]
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('Already following')
    }
    console.error(`[Contabo] Error following series:`, error)
    throw error
  }
}

/**
 * Unfollow a series in Contabo
 */
export async function unfollowSeriesInContabo(userId: string, seriesId: number): Promise<void> {
  try {
    await queryContabo(
      `DELETE FROM series_followers WHERE user_id = $1 AND series_id = $2`,
      [userId, seriesId]
    )
    console.log(`[Contabo] User ${userId} unfollowed series ${seriesId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error unfollowing series:`, error)
    throw error
  }
}

/**
 * Update notification preferences in Contabo
 */
export async function updateNotificationPreferencesInContabo(
  userId: string,
  preferences: {
    email_new_episodes?: boolean
    email_comment_replies?: boolean
    email_weekly_digest?: boolean
    email_new_favorites?: boolean
    email_marketing?: boolean
    digest_frequency?: string
  }
): Promise<any> {
  try {
    // Check if preferences exist
    const existingResult = await queryContabo<{ id: number }>(
      `SELECT id FROM notification_preferences WHERE user_id = $1`,
      [userId]
    )

    if (existingResult.rows.length > 0) {
      // Update existing
      const result = await queryContabo<{
        id: number
        user_id: string
        email_new_episodes: boolean
        email_comment_replies: boolean
        email_weekly_digest: boolean
        email_new_favorites: boolean
        email_marketing: boolean
        digest_frequency: string
        updated_at: string
      }>(
        `UPDATE notification_preferences 
         SET 
           email_new_episodes = COALESCE($2, email_new_episodes),
           email_comment_replies = COALESCE($3, email_comment_replies),
           email_weekly_digest = COALESCE($4, email_weekly_digest),
           email_new_favorites = COALESCE($5, email_new_favorites),
           email_marketing = COALESCE($6, email_marketing),
           digest_frequency = COALESCE($7, digest_frequency),
           updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [
          userId,
          preferences.email_new_episodes ?? null,
          preferences.email_comment_replies ?? null,
          preferences.email_weekly_digest ?? null,
          preferences.email_new_favorites ?? null,
          preferences.email_marketing ?? null,
          preferences.digest_frequency ?? null,
        ]
      )
      return result.rows[0]
    } else {
      // Create new
      const result = await queryContabo<{
        id: number
        user_id: string
        email_new_episodes: boolean
        email_comment_replies: boolean
        email_weekly_digest: boolean
        email_new_favorites: boolean
        email_marketing: boolean
        digest_frequency: string
        created_at: string
        updated_at: string
      }>(
        `INSERT INTO notification_preferences (
          user_id, email_new_episodes, email_comment_replies, email_weekly_digest,
          email_new_favorites, email_marketing, digest_frequency, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`,
        [
          userId,
          preferences.email_new_episodes ?? true,
          preferences.email_comment_replies ?? true,
          preferences.email_weekly_digest ?? true,
          preferences.email_new_favorites ?? false,
          preferences.email_marketing ?? false,
          preferences.digest_frequency ?? 'weekly',
        ]
      )
      return result.rows[0]
    }
  } catch (error: any) {
    console.error(`[Contabo] Error updating notification preferences:`, error)
    throw error
  }
}

/**
 * Mark all notifications as read in Contabo
 */
export async function markAllNotificationsReadInContabo(userId: string): Promise<void> {
  try {
    await queryContabo(
      `UPDATE talkflix_notifications 
       SET read = true 
       WHERE user_id = $1 AND read = false`,
      [userId]
    )
    console.log(`[Contabo] Marked all notifications as read for user ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error marking all notifications as read:`, error)
    throw error
  }
}

/**
 * Unmute user in Contabo (when mute expires)
 */
export async function unmuteUserInContabo(userId: string): Promise<void> {
  try {
    await queryContabo(
      `UPDATE profiles 
       SET is_muted = false, muted_until = NULL, muted_reason = NULL
       WHERE id = $1`,
      [userId]
    )
    console.log(`[Contabo] Unmuted user ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error unmuting user:`, error)
    throw error
  }
}

/**
 * Log email notification in Contabo
 */
export async function logEmailNotificationInContabo(data: {
  user_id: string
  notification_type: string
  email_address: string
  subject: string
  content_preview?: string | null
  movie_id?: number | null
  comment_id?: number | null
  status: "sent" | "failed"
  error_message?: string | null
}): Promise<void> {
  try {
    await queryContabo(
      `INSERT INTO email_notifications_log (
        user_id, notification_type, email_address, subject, 
        content_preview, movie_id, comment_id, status, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        data.user_id,
        data.notification_type,
        data.email_address,
        data.subject,
        data.content_preview || null,
        data.movie_id || null,
        data.comment_id || null,
        data.status,
        data.error_message || null,
      ]
    )
    console.log(`[Contabo] Logged email notification: ${data.notification_type} for user ${data.user_id}`)
  } catch (error: any) {
    console.error(`[Contabo] Error logging email notification:`, error)
    // Don't throw - email logging failures shouldn't break email sending
  }
}

/**
 * Update last digest sent timestamp in Contabo
 */
export async function updateLastDigestSentInContabo(userId: string): Promise<void> {
  try {
    await queryContabo(
      `UPDATE notification_preferences 
       SET last_digest_sent_at = NOW()
       WHERE user_id = $1`,
      [userId]
    )
    console.log(`[Contabo] Updated last digest sent timestamp for user ${userId}`)
  } catch (error: any) {
    console.error(`[Contabo] Error updating last digest sent:`, error)
    // Don't throw - this is not critical
  }
}

/**
 * Upsert advertisement in Contabo
 */
export async function upsertAdInContabo(
  position: string,
  content: string,
  isActive: boolean
): Promise<any> {
  try {
    // Check if ad exists
    const existing = await queryContabo<any>(
      'SELECT id FROM advertisements WHERE position = $1',
      [position]
    )

    if (existing.rows.length > 0) {
      // Update existing
      const result = await queryContabo<any>(
        `UPDATE advertisements 
         SET content = $1, is_active = $2, updated_at = $3 
         WHERE position = $4 
         RETURNING *`,
        [content || '', isActive, new Date().toISOString(), position]
      )
      console.log(`[Contabo] Updated ad for position: ${position}`)
      return result.rows[0]
    } else {
      // Insert new
      const result = await queryContabo<any>(
        `INSERT INTO advertisements (position, content, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [position, content || '', isActive, new Date().toISOString(), new Date().toISOString()]
      )
      console.log(`[Contabo] Inserted new ad for position: ${position}`)
      return result.rows[0]
    }
  } catch (error: any) {
    console.error(`[Contabo] Error upserting ad:`, error)
    throw error
  }
}

