import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

// GET - List all download links with optional filters
export const GET = adminRoute(async ({ request, supabase }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const movieId = searchParams.get("movieId")
    const episodeId = searchParams.get("episodeId")
    const search = searchParams.get("search") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "30")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        console.log(`[admin/download-links] GET - Fetching download links from Contabo, page=${page}, limit=${limit}`)
        
        // First, get a simple count with search
        let countParams: any[] = []
        let countParamIndex = 1
        let countWhere = 'WHERE 1=1'
        
        if (movieId) {
          countWhere += ` AND dl.movie_id = $${countParamIndex++}`
          countParams.push(Number.parseInt(movieId))
        }
        if (episodeId) {
          countWhere += ` AND dl.episode_id = $${countParamIndex++}`
          countParams.push(Number.parseInt(episodeId))
        }
        if (search) {
          countWhere += ` AND (
            m.title ILIKE $${countParamIndex} OR 
            dl.quality ILIKE $${countParamIndex} OR 
            dl.format ILIKE $${countParamIndex} OR 
            dl.provider ILIKE $${countParamIndex} OR
            dl.link_url ILIKE $${countParamIndex}
          )`
          const searchPattern = `%${search}%`
          countParams.push(searchPattern)
          countParamIndex++
        }
        
        const countSql = `
          SELECT COUNT(DISTINCT dl.id) as total 
          FROM download_links dl
          LEFT JOIN movies m ON dl.movie_id = m.id
          ${countWhere}
        `
        console.log(`[admin/download-links] Count SQL: ${countSql}`, countParams)
        
        const countResult = await queryContabo<{ total: string }>(countSql, countParams)
        const total = Number.parseInt(countResult.rows[0]?.total || '0', 10)
        console.log(`[admin/download-links] Total download links found: ${total}`)
        
        // Build SQL with joins to get movie and episode information
        let sql = `
          SELECT 
            dl.id,
            dl.movie_id,
            dl.episode_id,
            dl.quality,
            dl.format,
            dl.link_url,
            dl.provider,
            dl.file_size,
            dl.status,
            dl.uploaded_by,
            dl.created_at,
            dl.updated_at,
            m.id as m_id,
            m.title as m_title,
            m.type as m_type,
            e.id as e_id,
            e.title as e_title,
            e.episode_number as e_episode_number,
            s.season_number as s_season_number
          FROM download_links dl
          LEFT JOIN movies m ON dl.movie_id = m.id
          LEFT JOIN episodes e ON dl.episode_id = e.id
          LEFT JOIN seasons s ON e.season_id = s.id
          WHERE 1=1
        `
        const params: any[] = []
        let paramIndex = 1

        if (movieId) {
          sql += ` AND dl.movie_id = $${paramIndex++}`
          params.push(Number.parseInt(movieId))
        }

        if (episodeId) {
          sql += ` AND dl.episode_id = $${paramIndex++}`
          params.push(Number.parseInt(episodeId))
        }

        if (search) {
          sql += ` AND (
            m.title ILIKE $${paramIndex} OR 
            dl.quality ILIKE $${paramIndex} OR 
            dl.format ILIKE $${paramIndex} OR 
            dl.provider ILIKE $${paramIndex} OR
            dl.link_url ILIKE $${paramIndex}
          )`
          const searchPattern = `%${search}%`
          params.push(searchPattern)
          paramIndex++
        }

        // Apply pagination
        const offset = (page - 1) * limit
        sql += ` ORDER BY dl.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
        params.push(limit, offset)

        console.log(`[admin/download-links] Main SQL: ${sql}`, params)
        const result = await queryContabo<any>(sql, params)
        
        console.log(`[admin/download-links] Raw result rows: ${result.rows.length}`)
        if (result.rows.length > 0) {
          console.log(`[admin/download-links] First row sample:`, JSON.stringify(result.rows[0], null, 2))
        }

        // Transform the result to match the Supabase format
        const transformedData = result.rows.map((row: any) => ({
          id: row.id,
          movie_id: row.movie_id,
          episode_id: row.episode_id,
          quality: row.quality,
          format: row.format,
          link_url: row.link_url,
          provider: row.provider,
          file_size: row.file_size,
          status: row.status,
          uploaded_by: row.uploaded_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          movies: row.m_id ? {
            id: row.m_id,
            title: row.m_title,
            type: row.m_type
          } : null,
          episodes: row.e_id ? {
            id: row.e_id,
            title: row.e_title,
            episode_number: row.e_episode_number,
            seasons: row.s_season_number ? {
              season_number: row.s_season_number
            } : null
          } : null
        }))
        
        console.log(`[admin/download-links] Transformed data count: ${transformedData.length}`)
        console.log(`[admin/download-links] Returning response with ${transformedData.length} links, total: ${total}`)

        return jsonResponse({
          data: transformedData,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        })
      } catch (contaboError: any) {
        console.error("[admin/download-links] Contabo error in GET:", contaboError)
        console.error("[admin/download-links] Error details:", {
          message: contaboError.message,
          code: contaboError.code,
          detail: contaboError.detail,
          stack: contaboError.stack
        })
        return jsonResponse({ 
          error: "Failed to fetch download links",
          details: contaboError.message 
        }, 500)
      }
    }

    // Fallback to Supabase
    let query = supabase.from("download_links").select(
      `
        *,
        movies!download_links_movie_id_fkey(id, title, type),
        episodes!download_links_episode_id_fkey(id, title, episode_number, season_id, seasons!episodes_season_id_fkey(season_number))
      `,
      { count: "exact" },
    )

    // Apply filters
    if (movieId) {
      query = query.eq("movie_id", Number.parseInt(movieId))
    }

    if (episodeId) {
      query = query.eq("episode_id", Number.parseInt(episodeId))
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order("created_at", { ascending: false })

    const { data, error, count } = await query

    if (error) {
      console.error("[v0] Error fetching download links:", error)
      return jsonResponse({ error: "Failed to fetch download links" }, 500)
    }

    return jsonResponse({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error("[admin] Error in download links GET:", error)
    console.error("[admin] Error stack:", error?.stack)
    console.error("[admin] Error message:", error?.message)
    return jsonResponse({ error: "Internal server error", details: error?.message }, 500)
  }
})

// POST - Add new download link
export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    const body = await request.json()
    const { movie_id, episode_id, quality, format, link_url, provider, file_size, uploaded_by } = body

    if (!movie_id || !quality || !link_url) {
      return jsonResponse({ error: "Missing required fields: movie_id, quality, link_url" }, 400)
    }

    const movieIdNum = Number.parseInt(movie_id)
    const episodeIdNum = episode_id ? Number.parseInt(episode_id) : null

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { addDownloadLinkToContabo } = await import('@/lib/database/contabo-writes')
        console.log(`[admin/download-links] Attempting to add download link to Contabo:`, {
          movieId: movieIdNum,
          episodeId: episodeIdNum,
          quality,
          link_url,
          format,
          provider
        })
        
        const data = await addDownloadLinkToContabo(
          movieIdNum,
          quality,
          link_url,
          format || "MP4",
          provider || "",
          file_size || "",
          uploaded_by || "admin",
          episodeIdNum
        )
        console.log(`[admin/download-links] Successfully added download link to Contabo: movie ${movieIdNum}${episodeIdNum ? `, episode ${episodeIdNum}` : ''}`)
        console.log(`[admin/download-links] Returned data:`, JSON.stringify(data, null, 2))
        return jsonResponse({ success: true, data })
      } catch (contaboError: any) {
        console.error("[admin/download-links] Contabo error:", contaboError)
        console.error("[admin/download-links] Error details:", {
          message: contaboError.message,
          code: contaboError.code,
          detail: contaboError.detail,
          hint: contaboError.hint
        })
        
        // Check if it's a duplicate key error
        if (contaboError.code === "23505" || contaboError.message?.includes("duplicate")) {
          return jsonResponse(
            { error: "Download link with this quality and provider already exists" },
            409
          )
        }
        
        // Return the error instead of falling through to Supabase
        return jsonResponse(
          { 
            error: "Failed to add download link", 
            details: contaboError.message || "Unknown error",
            code: contaboError.code 
          },
          500
        )
      }
    }

    // Fallback to Supabase
    const insertData: any = {
      movie_id: movieIdNum,
      quality,
      format: format || "MP4",
      link_url,
      provider: provider || "",
      file_size: file_size || "",
      uploaded_by: uploaded_by || "admin",
      status: "active",
    }

    // Add episode_id only if provided (for series)
    if (episodeIdNum) {
      insertData.episode_id = episodeIdNum
    }

    const { data, error } = await supabase.from("download_links").insert(insertData).select().single()

    if (error) {
      console.error("[v0] Error adding download link:", error)
      if (error.code === "23505") {
        return jsonResponse(
          { error: "Download link with this quality and provider already exists" },
          409
        )
      }
      return jsonResponse({ error: "Failed to add download link" }, 500)
    }

    return jsonResponse({ success: true, data })
  } catch (error) {
    console.error("[admin] Error in download links POST:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
