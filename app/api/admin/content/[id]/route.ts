import { type NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

function getIdFromParams(params?: Record<string, string | string[]>) {
  const raw = params?.id
  return Array.isArray(raw) ? raw[0] : raw
}

async function resolveId(
  routeContext: { params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> } | undefined,
  request: Request,
): Promise<string | undefined> {
  // Handle Next.js 15 async params
  let params: Record<string, string | string[]> | undefined
  if (routeContext?.params) {
    params = routeContext.params instanceof Promise 
      ? await routeContext.params 
      : routeContext.params
  }
  
  const fromParams = getIdFromParams(params)
  if (fromParams) return fromParams

  // Fallback: try to extract from URL path
  try {
    const url = new URL(request.url)
    const parts = url.pathname.split("/").filter(Boolean)
    const last = parts.pop() || null
    if (!last) return undefined
    const sanitized = last.split("?")[0].split("#")[0]
    return sanitized || undefined
  } catch {
    return undefined
  }
}

export const PATCH = adminRoute(async ({ request }, routeContext) => {
  try {
    console.log("[admin/content/:id] PATCH - Starting request")
    console.log("[admin/content/:id] PATCH - routeContext:", routeContext)
    
    const paramId = await resolveId(routeContext, request)
    console.log("[admin/content/:id] PATCH - Raw params.id:", paramId, "Type:", typeof paramId)
    
    if (!paramId) {
      console.log("[admin/content/:id] PATCH - No ID found in params or URL")
      return jsonResponse({ error: "Missing content ID" }, 400)
    }

    const id = Number.parseInt(paramId, 10)

    console.log("[admin/content/:id] PATCH - Parsed ID:", id, "isNaN:", Number.isNaN(id))

    if (Number.isNaN(id) || id <= 0) {
      console.log("[admin/content/:id] PATCH - Invalid ID detected")
      return jsonResponse({ error: "Invalid content ID" }, 400)
    }

    let body
    try {
      body = await request.json()
      console.log("[admin/content/:id] PATCH - Request body:", body)
    } catch (parseError: any) {
      console.error("[admin/content/:id] PATCH - Error parsing request body:", parseError)
      return jsonResponse({ 
        error: "Invalid request body", 
        details: parseError.message || "Failed to parse JSON"
      }, 400)
    }

    const { title, description } = body || {}

    if (!title && !description) {
      console.log("[admin/content/:id] PATCH - No fields to update")
      return jsonResponse({ error: "No fields to update" }, 400)
    }

    console.log("[admin/content/:id] PATCH - USE_CONTABO_DB:", process.env.USE_CONTABO_DB)

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        const updateFields: string[] = []
        const values: any[] = []
        let paramIndex = 1

        if (title) {
          updateFields.push(`title = $${paramIndex}`)
          values.push(title)
          paramIndex++
        }
        if (description) {
          updateFields.push(`description = $${paramIndex}`)
          values.push(description)
          paramIndex++
        }
        
        // Always update updated_at
        updateFields.push(`updated_at = $${paramIndex}`)
        values.push(new Date().toISOString())
        paramIndex++
        
        // Add id to values array for WHERE clause
        values.push(id)
        const idParamIndex = paramIndex
        
        if (updateFields.length === 1 && updateFields[0].startsWith('updated_at')) {
          // Only updating timestamp - no actual changes
          console.log("[admin/content/:id] PATCH - Only timestamp update requested")
        }
        
        const sql = `UPDATE movies SET ${updateFields.join(', ')} WHERE id = $${idParamIndex} RETURNING *`
        
        console.log("[admin/content/:id] PATCH - SQL:", sql)
        console.log("[admin/content/:id] PATCH - Values:", values)
        console.log("[admin/content/:id] PATCH - paramIndex:", paramIndex, "idParamIndex:", idParamIndex)
        
        const result = await queryContabo<any>(sql, values)
        
        if (!result || !result.rows || result.rows.length === 0) {
          console.error("[admin/content/:id] PATCH - No rows returned, content not found or update failed")
          return jsonResponse({ error: "Content not found" }, 404)
        }

        console.log("[admin/content/:id] PATCH - Success, updated:", result.rows[0].id)
        return jsonResponse({ success: true, data: result.rows[0] })
      } catch (contaboError: any) {
        console.error("[admin/content/:id] PATCH - Contabo error:", contaboError)
        console.error("[admin/content/:id] PATCH - Error message:", contaboError.message)
        console.error("[admin/content/:id] PATCH - Error stack:", contaboError.stack)
        return jsonResponse({ 
          error: "Failed to update content", 
          details: contaboError.message || "Unknown error"
        }, 500)
      }
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (title) updateData.title = title
    if (description) updateData.description = description

    const { data, error } = await supabase.from("movies").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("[v0] Error updating content:", error)
      return jsonResponse({ error: "Failed to update content" }, 500)
    }

    return jsonResponse({ success: true, data })
  } catch (error: any) {
    console.error("[admin/content/:id] PATCH - Unexpected error:", error)
    console.error("[admin/content/:id] PATCH - Error message:", error?.message)
    console.error("[admin/content/:id] PATCH - Error stack:", error?.stack)
    console.error("[admin/content/:id] PATCH - Error name:", error?.name)
    return jsonResponse({ 
      error: "Internal server error", 
      details: error?.message || "Unknown error",
      type: error?.name || "Error"
    }, 500)
  }
})

export const DELETE = adminRoute(async ({ request }, routeContext) => {
  try {
    const paramId = await resolveId(routeContext, request)
    console.log("[v0] DELETE request - Raw params.id:", paramId, "Type:", typeof paramId)
    
    if (!paramId) {
      console.log("[v0] DELETE - No ID found in params or URL")
      return jsonResponse({ error: "Missing content ID" }, 400)
    }

    const id = Number.parseInt(paramId, 10)

    console.log("[v0] Parsed ID:", id, "isNaN:", Number.isNaN(id))

    if (Number.isNaN(id) || id <= 0) {
      console.log("[v0] Invalid ID detected")
      return jsonResponse({ error: "Invalid content ID" }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      // First, get the movie/series details
      const movieResult = await queryContabo<{ type: string; title: string }>(
        'SELECT type, title FROM movies WHERE id = $1',
        [id]
      )

      if (movieResult.rows.length === 0) {
        return jsonResponse({ error: "Content not found" }, 404)
      }

      const movie = movieResult.rows[0]
      console.log("[v0] Fetched content:", movie)

      // If it's a series, delete related seasons and episodes
      if (movie.type === "series") {
        console.log("[v0] Deleting series-related data for:", movie.title)
        
        // Get all seasons for this series
        const seasonsResult = await queryContabo<{ id: number }>(
          'SELECT id FROM seasons WHERE movie_id = $1',
          [id]
        )

        if (seasonsResult.rows.length > 0) {
          const seasonIds = seasonsResult.rows.map((s) => s.id)

          // Delete episodes for these seasons
          await queryContabo('DELETE FROM episodes WHERE season_id = ANY($1)', [seasonIds])

          // Delete seasons
          await queryContabo('DELETE FROM seasons WHERE movie_id = $1', [id])
        }
      }

      // Delete related records (CASCADE should handle most, but explicit is safer)
      console.log("[v0] Deleting related records for:", movie.title)
      await queryContabo('DELETE FROM movie_genres WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM movie_actors WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM movie_tags WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM movie_countries WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM comments WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM download_links WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM favorites WHERE movie_id = $1', [id])
      await queryContabo('DELETE FROM watchlist WHERE movie_id = $1', [id])

      // Delete the movie/series itself
      console.log("[v0] Deleting content:", movie.title)
      await queryContabo('DELETE FROM movies WHERE id = $1', [id])

      console.log("[v0] Successfully deleted:", movie.title)
      return jsonResponse({ success: true, message: `"${movie.title}" has been deleted successfully` })
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    // First, get the movie/series details to check if it's a series
    const { data: movie, error: fetchError } = await supabase.from("movies").select("type, title").eq("id", id).single()

    console.log("[v0] Fetched content:", movie, "Error:", fetchError)

    if (fetchError || !movie) {
      console.error("[v0] Error fetching content:", fetchError)
      return jsonResponse({ error: "Content not found" }, 404)
    }

    // If it's a series, delete related seasons and episodes
    if (movie.type === "series") {
      console.log("[v0] Deleting series-related data for:", movie.title)
      // Get all seasons for this series
      const { data: seasons } = await supabase.from("seasons").select("id").eq("movie_id", id)

      if (seasons && seasons.length > 0) {
        const seasonIds = seasons.map((s) => s.id)

        // Delete episodes for these seasons
        await supabase.from("episodes").delete().in("season_id", seasonIds)

        // Delete seasons
        await supabase.from("seasons").delete().eq("movie_id", id)
      }
    }

    // Delete related records
    console.log("[v0] Deleting related records for:", movie.title)
    await supabase.from("movie_genres").delete().eq("movie_id", id)
    await supabase.from("movie_actors").delete().eq("movie_id", id)
    await supabase.from("comments").delete().eq("movie_id", id)

    // Delete the movie/series itself
    console.log("[v0] Deleting content:", movie.title)
    const { error: deleteError } = await supabase.from("movies").delete().eq("id", id)

    if (deleteError) {
      console.error("[v0] Error deleting content:", deleteError)
      return jsonResponse({ error: "Failed to delete content" }, 500)
    }

    console.log("[v0] Successfully deleted:", movie.title)
    return jsonResponse({ success: true, message: `"${movie.title}" has been deleted successfully` })
  } catch (error) {
    console.error("[v0] Error in content DELETE:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
