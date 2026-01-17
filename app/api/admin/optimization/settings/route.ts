import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    const settings = await request.json()

    // Validate settings
    if (settings.cache_ttl_movies < 60 || settings.cache_ttl_movies > 3600) {
      return jsonResponse({ error: "Movie cache TTL must be between 60 and 3600 seconds" }, 400)
    }

    if (settings.items_per_page < 10 || settings.items_per_page > 100) {
      return jsonResponse({ error: "Items per page must be between 10 and 100" }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      // Check if optimization_settings key exists
      const existing = await queryContabo<any>(
        `SELECT id FROM site_settings WHERE key = $1`,
        ['optimization_settings']
      )

      if (existing.rows.length > 0) {
        // Update existing
        await queryContabo(
          `UPDATE site_settings 
           SET value = $1::jsonb, updated_at = $2 
           WHERE key = $3`,
          [JSON.stringify(settings), new Date().toISOString(), 'optimization_settings']
        )
      } else {
        // Insert new
        await queryContabo(
          `INSERT INTO site_settings (key, value, created_at, updated_at)
           VALUES ($1, $2::jsonb, $3, $4)`,
          ['optimization_settings', JSON.stringify(settings), new Date().toISOString(), new Date().toISOString()]
        )
      }

      return jsonResponse({
        success: true,
        message: "Optimization settings saved successfully",
      })
    }

    // Fallback to Supabase
    // Save settings to database
    const { error } = await supabase.from("site_settings").upsert({
      key: "optimization_settings",
      value: settings,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error("[v0] Error saving optimization settings:", error)
      return jsonResponse({ error: "Failed to save settings" }, 500)
    }

    return jsonResponse({
      success: true,
      message: "Optimization settings saved successfully",
    })
  } catch (error) {
    console.error("[v0] Error in optimization settings API:", error)
    return jsonResponse({ error: "Failed to save settings" }, 500)
  }
})

export const GET = adminRoute(async ({ supabase }) => {
  try {
    // Return default settings if not found
    const defaultSettings = {
      enable_caching: true,
      cache_ttl_movies: 300,
      cache_ttl_trending: 180,
      enable_image_optimization: true,
      enable_lazy_loading: true,
      items_per_page: 20,
      query_timeout: 10000,
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      const result = await queryContabo<any>(
        `SELECT value FROM site_settings WHERE key = $1`,
        ['optimization_settings']
      )

      if (result.rows.length > 0) {
        const value = result.rows[0].value
        // Parse JSONB if it's a string
        if (typeof value === 'string') {
          try {
            return jsonResponse(JSON.parse(value))
          } catch {
            return jsonResponse(defaultSettings)
          }
        }
        return jsonResponse(value || defaultSettings)
      }

      return jsonResponse(defaultSettings)
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "optimization_settings")
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("[v0] Error fetching optimization settings:", error)
      return jsonResponse({ error: "Failed to fetch settings" }, 500)
    }

    return jsonResponse(data?.value || defaultSettings)
  } catch (error) {
    console.error("[v0] Error in optimization settings GET API:", error)
    return jsonResponse({ error: "Failed to fetch settings" }, 500)
  }
})
