import { type NextRequest, NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const GET = adminRoute(async ({ request, supabase }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const type = searchParams.get("type") || "all" // all, movie, series

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      // Build SQL query
      let sql = `
        SELECT 
          id, title, description, poster_url, type, rating, release_date, quality, views, created_at
        FROM movies
        WHERE 1=1
      `
      const params: any[] = []
      let paramIndex = 1

      // Apply search filter
      if (search) {
        sql += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
        params.push(`%${search}%`)
        paramIndex++
      }

      // Apply type filter
      if (type !== "all") {
        sql += ` AND type = $${paramIndex}`
        params.push(type)
        paramIndex++
      }

      // Get total count
      let countSql = `SELECT COUNT(*) as total FROM movies WHERE 1=1`
      const countParams: any[] = []
      let countParamIndex = 1

      if (search) {
        countSql += ` AND (title ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`
        countParams.push(`%${search}%`)
        countParamIndex++
      }

      if (type !== "all") {
        countSql += ` AND type = $${countParamIndex}`
        countParams.push(type)
        countParamIndex++
      }

      // Apply pagination
      const offset = (page - 1) * limit
      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      params.push(limit, offset)

      // Execute queries
      const [dataResult, countResult] = await Promise.all([
        queryContabo<any>(sql, params),
        queryContabo<{ total: string }>(countSql, countParams),
      ])

      const data = dataResult.rows || []
      const total = Number.parseInt(countResult.rows[0]?.total || '0', 10)

      // Fetch seasons for series
      const moviesWithDetails = await Promise.all(
        data.map(async (movie: any) => {
          if (movie.type === "series") {
            const seasonsResult = await queryContabo<any>(
              `SELECT 
                s.id,
                s.season_number,
                s.title,
                COALESCE(
                  json_agg(
                    jsonb_build_object(
                      'id', e.id,
                      'episode_number', e.episode_number,
                      'title', e.title
                    ) ORDER BY e.episode_number
                  ) FILTER (WHERE e.id IS NOT NULL),
                  '[]'::json
                ) as episodes
              FROM seasons s
              LEFT JOIN episodes e ON s.id = e.season_id
              WHERE s.movie_id = $1
              GROUP BY s.id
              ORDER BY s.season_number ASC`,
              [movie.id]
            )
            movie.seasons = seasonsResult.rows || []
          }
          return movie
        })
      )

      return jsonResponse({
        data: moviesWithDetails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    }

    // Fallback to Supabase
    // Build query
    let query = supabase
      .from("movies")
      .select("id, title, description, poster_url, type, rating, release_date, quality, views, created_at", {
        count: "exact",
      })

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply type filter
    if (type !== "all") {
      query = query.eq("type", type)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order("created_at", { ascending: false })

    const { data, error, count } = await query

    if (error) {
      console.error("[v0] Error fetching content:", error)
      return jsonResponse({ error: "Failed to fetch content" }, 500)
    }

    const moviesWithDetails = await Promise.all(
      (data || []).map(async (movie: any) => {
        if (movie.type === "series") {
          const { data: seasons } = await supabase
            .from("seasons")
            .select(
              `
              id,
              season_number,
              title,
              episodes (
                id,
                episode_number,
                title
              )
            `,
            )
            .eq("movie_id", movie.id)
            .order("season_number", { ascending: true })

          // Sort episodes within each season
          if (seasons) {
            seasons.forEach((season: any) => {
              if (season.episodes) {
                season.episodes.sort((a: any, b: any) => a.episode_number - b.episode_number)
              }
            })
          }

          movie.seasons = seasons || []
        }
        return movie
      }),
    )

    return jsonResponse({
      data: moviesWithDetails,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error("[admin] Error in content GET:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
