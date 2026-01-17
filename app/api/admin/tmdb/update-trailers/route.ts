import { NextResponse } from "next/server"
import { adminRoute } from "@/lib/security/admin-middleware"
import { queryContabo } from "@/lib/database/contabo-pool"
import { createServiceRoleClient } from "@/lib/supabase/server"

const TMDB_API_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY"
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

// Helper function to extract YouTube trailer URL from TMDB videos
// Expanded to find more video types: trailers, teasers, featurettes, and clips
function extractTrailerUrl(videos: any): string | null {
  if (!videos || !videos.results || !Array.isArray(videos.results)) {
    return null
  }
  
  const videoResults = videos.results || []
  
  // Priority order:
  // 1. Official YouTube Trailer
  // 2. Any YouTube Trailer
  // 3. Official YouTube Teaser
  // 4. Any YouTube Teaser
  // 5. Official YouTube Featurette
  // 6. Official YouTube Clip
  // 7. Any YouTube Featurette or Clip
  
  const priorities = [
    // Priority 1: Official Trailer
    (v: any) => v.type === "Trailer" && v.site === "YouTube" && v.official === true,
    // Priority 2: Any Trailer
    (v: any) => v.type === "Trailer" && v.site === "YouTube",
    // Priority 3: Official Teaser
    (v: any) => v.type === "Teaser" && v.site === "YouTube" && v.official === true,
    // Priority 4: Any Teaser
    (v: any) => v.type === "Teaser" && v.site === "YouTube",
    // Priority 5: Official Featurette
    (v: any) => v.type === "Featurette" && v.site === "YouTube" && v.official === true,
    // Priority 6: Official Clip
    (v: any) => v.type === "Clip" && v.site === "YouTube" && v.official === true,
    // Priority 7: Any Featurette or Clip
    (v: any) => (v.type === "Featurette" || v.type === "Clip") && v.site === "YouTube",
  ]
  
  for (const priority of priorities) {
    const video = videoResults.find(priority)
    if (video && video.key) {
      return `https://www.youtube.com/embed/${video.key}`
    }
  }
  
  return null
}

export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    if (TMDB_API_KEY === "YOUR_TMDB_API_KEY") {
      return NextResponse.json(
        { error: "TMDB API key not configured" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { type = "all", limit = 200 } = body // type: "movie", "series", or "all" (increased default to 200)

    const useContabo = process.env.USE_CONTABO_DB === 'true'
    
    let moviesToUpdate: any[] = []
    let totalCount = 0

    if (useContabo) {
      // First, get total count
      let countSql = `
        SELECT COUNT(*) as count
        FROM movies
        WHERE tmdb_id IS NOT NULL 
          AND tmdb_id != ''
          AND (trailer_url IS NULL OR trailer_url = '')
      `
      
      if (type !== "all") {
        countSql += ` AND type = $1`
        const countResult = await queryContabo<{ count: string }>(countSql, [type])
        totalCount = Number.parseInt(countResult.rows[0]?.count || '0', 10)
      } else {
        const countResult = await queryContabo<{ count: string }>(countSql, [])
        totalCount = Number.parseInt(countResult.rows[0]?.count || '0', 10)
      }
      
      // Get movies/series with tmdb_id but no trailer_url
      let sql = `
        SELECT id, title, tmdb_id, type, trailer_url
        FROM movies
        WHERE tmdb_id IS NOT NULL 
          AND tmdb_id != ''
          AND (trailer_url IS NULL OR trailer_url = '')
        ORDER BY id
      `
      
      if (type !== "all") {
        sql += ` AND type = $1`
        const result = await queryContabo<any>(sql, [type])
        moviesToUpdate = result.rows
      } else {
        const result = await queryContabo<any>(sql, [])
        moviesToUpdate = result.rows
      }
      
      // Limit results
      moviesToUpdate = moviesToUpdate.slice(0, limit)
    } else {
      // For Supabase, get total count first
      let countQuery = supabase
        .from("movies")
        .select("id", { count: "exact", head: true })
        .not("tmdb_id", "is", null)
        .neq("tmdb_id", "")
      
      if (type !== "all") {
        countQuery = countQuery.eq("type", type)
      }
      
      const { count } = await countQuery
      totalCount = count || 0
      
      // For Supabase, we need to check for null or empty trailer_url
      // We'll use a filter that checks both conditions
      let query = supabase
        .from("movies")
        .select("id, title, tmdb_id, type, trailer_url")
        .not("tmdb_id", "is", null)
        .neq("tmdb_id", "")
        .order("id", { ascending: true })
        .limit(limit * 2) // Get more to filter out ones with trailers
      
      if (type !== "all") {
        query = query.eq("type", type)
      }
      
      const { data } = await query
      // Filter in JavaScript to ensure we only get movies without trailers
      moviesToUpdate = (data || []).filter(
        (m: any) => !m.trailer_url || m.trailer_url === ""
      ).slice(0, limit)
    }

    console.log(`[update-trailers] Total items needing trailers: ${totalCount}, Processing: ${moviesToUpdate.length}`)

    const results = {
      updated: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    }

    // Update trailers for each movie/series
    for (const movie of moviesToUpdate) {
      try {
        const tmdbId = movie.tmdb_id
        const contentType = movie.type === "series" ? "tv" : "movie"
        
        // Fetch videos from TMDB
        const videosUrl = `${TMDB_BASE_URL}/${contentType}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`
        const videosResponse = await fetch(videosUrl)
        
        if (!videosResponse.ok) {
          console.log(`[update-trailers] Failed to fetch videos for ${movie.title} (TMDB ID: ${tmdbId})`)
          results.failed++
          results.details.push({
            id: movie.id,
            title: movie.title,
            status: "failed",
            error: "TMDB API error",
          })
          continue
        }

        const videosData = await videosResponse.json()
        const trailerUrl = extractTrailerUrl(videosData)

        if (!trailerUrl) {
          // Log available video types for debugging
          const availableTypes = videosData.results?.map((v: any) => `${v.type}${v.official ? ' (official)' : ''} (${v.site || 'unknown'})`).join(', ') || 'none'
          console.log(`[update-trailers] No suitable video found for ${movie.title}. Available: ${availableTypes}`)
          results.skipped++
          results.details.push({
            id: movie.id,
            title: movie.title,
            status: "skipped",
            reason: `No suitable video available. Found: ${availableTypes}`,
          })
          continue
        }

        // Update trailer_url in database
        if (useContabo) {
          await queryContabo(
            `UPDATE movies SET trailer_url = $1 WHERE id = $2`,
            [trailerUrl, movie.id]
          )
        } else {
          await supabase
            .from("movies")
            .update({ trailer_url: trailerUrl })
            .eq("id", movie.id)
        }

        console.log(`[update-trailers] Updated trailer for ${movie.title}`)
        results.updated++
        results.details.push({
          id: movie.id,
          title: movie.title,
          status: "updated",
          trailer_url: trailerUrl,
        })

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error: any) {
        console.error(`[update-trailers] Error updating ${movie.title}:`, error)
        results.failed++
        results.details.push({
          id: movie.id,
          title: movie.title,
          status: "failed",
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      total: moviesToUpdate.length,
      totalRemaining: Math.max(0, totalCount - moviesToUpdate.length),
      updated: results.updated,
      failed: results.failed,
      skipped: results.skipped,
      details: results.details,
    })
  } catch (error: any) {
    console.error("[update-trailers] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update trailers" },
      { status: 500 }
    )
  }
})

