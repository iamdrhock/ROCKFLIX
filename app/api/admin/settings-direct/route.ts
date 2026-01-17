import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

// Simple JSON response helper that only uses native Response
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// GET: Fetch site settings
export async function GET(_req: NextRequest) {
  try {
    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const result = await queryContabo<any>('SELECT * FROM site_settings WHERE id = $1 LIMIT 1', [1])
        
        if (result.rows.length === 0) {
          return jsonResponse({ error: "Settings not found" }, 404)
        }

        return jsonResponse(result.rows[0], 200)
      } catch (contaboError: any) {
        console.error("[settings-direct][GET] Contabo error:", contaboError)
        // Fall through to Supabase fallback
      }
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .single()

    if (error) {
      console.error("[settings-direct][GET] Supabase error:", error)
      return jsonResponse({ error: "Failed to fetch settings" }, 500)
    }

    if (!data) {
      return jsonResponse({ error: "Settings not found" }, 404)
    }

    return jsonResponse(data, 200)
  } catch (err: any) {
    console.error("[settings-direct][GET] Unhandled error:", err)
    return jsonResponse(
      { error: "Internal server error", message: err?.message || "Unknown error" },
      500,
    )
  }
}

// PATCH: Update site settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        // Build UPDATE query dynamically
        const updateFields = Object.keys(body).filter(key => key !== 'id' && key !== 'created_at')
        const jsonbColumns = ['header_menu', 'footer_links', 'social_links', 'quick_links']
        
        const setParts: string[] = []
        const values: any[] = []
        let paramIndex = 1

        for (const key of updateFields) {
          const escapedKey = `"${key}"`
          const value = body[key]
          
          if (jsonbColumns.includes(key)) {
            if (value === null || value === undefined) {
              setParts.push(`${escapedKey} = $${paramIndex}`)
              values.push(null)
            } else {
              setParts.push(`${escapedKey} = $${paramIndex}::jsonb`)
              values.push(JSON.stringify(value))
            }
          } else {
            setParts.push(`${escapedKey} = $${paramIndex}`)
            values.push(value === null || value === undefined ? null : value)
          }
          paramIndex++
        }
        
        setParts.push(`"updated_at" = $${paramIndex}`)
        values.push(new Date().toISOString())
        paramIndex++
        
        const sql = `UPDATE site_settings SET ${setParts.join(', ')} WHERE id = $${paramIndex} RETURNING *`
        values.push(1)

        const result = await queryContabo<any>(sql, values)

        if (result.rows.length === 0) {
          return jsonResponse({ error: "Settings not found" }, 404)
        }

        return jsonResponse(result.rows[0], 200)
      } catch (contaboError: any) {
        console.error("[settings-direct][PATCH] Contabo error:", contaboError)
        // Fall through to Supabase fallback
      }
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from("site_settings")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select()
      .single()

    if (error) {
      console.error("[settings-direct][PATCH] Supabase error:", error)
      return jsonResponse(
        {
          error: "Failed to update settings",
          details: error.message,
          code: error.code,
        },
        500,
      )
    }

    return jsonResponse(data, 200)
  } catch (err: any) {
    console.error("[settings-direct][PATCH] Unhandled error:", err)
    return jsonResponse(
      { error: "Internal server error", message: err?.message || "Unknown error" },
      500,
    )
  }
}


