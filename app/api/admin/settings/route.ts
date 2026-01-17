import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const GET = adminRoute(async ({ supabase }) => {
  try {
    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      console.log('[admin/settings] GET - Querying Contabo for site_settings...')
      
      // First check if any settings exist
      const countResult = await queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM site_settings', [])
      const count = Number.parseInt(countResult.rows[0]?.count || '0', 10)
      console.log(`[admin/settings] Total site_settings rows in database: ${count}`)
      
      const result = await queryContabo<any>('SELECT * FROM site_settings WHERE id = $1 LIMIT 1', [1])
      
      console.log(`[admin/settings] Query result: ${result.rows.length} row(s) found`)
      
      if (result.rows.length === 0) {
        console.error('[admin/settings] No settings found with id=1. Attempting to create default settings...')
        
        // Try to insert default settings
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
          
          console.log('[admin/settings] Default settings created successfully')
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
          
          return jsonResponse(settings)
        } catch (insertError: any) {
          console.error('[admin/settings] Failed to create default settings:', insertError)
          return jsonResponse({ 
            error: "Settings not found and could not create defaults",
            details: insertError.message 
          }, 500)
        }
      }

      const row = result.rows[0]
      console.log('[admin/settings] Raw row data:', {
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
      
      console.log('[admin/settings] GET - Fetched settings from Contabo:', {
        site_title: settings.site_title,
        footer_text: settings.footer_text,
        footer_links_count: Array.isArray(settings.footer_links) ? settings.footer_links.length : 0,
        quick_links_count: Array.isArray(settings.quick_links) ? settings.quick_links.length : 0,
      })

      return jsonResponse(settings)
    }

    // Fallback to Supabase
    const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single()

    if (error) throw error

    return jsonResponse(data)
  } catch (error) {
    console.error("[admin] Error fetching settings:", error)
    return jsonResponse({ error: "Failed to fetch settings" }, 500)
  }
})

export const PATCH = adminRoute(async ({ supabase, request }) => {
  try {
    const body = await request.json()
    
    console.log('[admin/settings] PATCH request received:', {
      useContabo: process.env.USE_CONTABO_DB,
      bodyKeys: Object.keys(body),
    })

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      // Build UPDATE query dynamically based on body keys
      const updateFields = Object.keys(body).filter(key => key !== 'id' && key !== 'created_at')
      
      if (updateFields.length === 0) {
        // Just update timestamp if no other fields
        const result = await queryContabo<any>(
          'UPDATE site_settings SET updated_at = $1 WHERE id = $2 RETURNING *',
          [new Date().toISOString(), 1]
        )
        
        if (result.rows.length === 0) {
          return jsonResponse({ error: "Settings not found" }, 404)
        }

        return jsonResponse(result.rows[0])
      }

      // JSONB columns that need special handling
      const jsonbColumns = ['header_menu', 'footer_links', 'social_links', 'quick_links']
      
      // Build SET clause and values array
      const setParts: string[] = []
      const values: any[] = []
      let paramIndex = 1

      for (const key of updateFields) {
        const escapedKey = `"${key}"`
        const value = body[key]
        
        // Handle JSONB fields
        if (jsonbColumns.includes(key)) {
          if (value === null || value === undefined) {
            setParts.push(`${escapedKey} = $${paramIndex}`)
            values.push(null)
          } else if (typeof value === 'object') {
            setParts.push(`${escapedKey} = $${paramIndex}::jsonb`)
            values.push(JSON.stringify(value))
          } else {
            // Try to parse if it's a string
            try {
              const parsed = typeof value === 'string' ? JSON.parse(value) : value
              setParts.push(`${escapedKey} = $${paramIndex}::jsonb`)
              values.push(JSON.stringify(parsed))
            } catch {
              setParts.push(`${escapedKey} = $${paramIndex}::jsonb`)
              values.push(JSON.stringify(value))
            }
          }
        } else {
          // Regular fields
          setParts.push(`${escapedKey} = $${paramIndex}`)
          
          if (value === null || value === undefined) {
            values.push(null)
          } else if (typeof value === 'boolean') {
            values.push(value)
          } else if (typeof value === 'number') {
            values.push(value)
          } else {
            values.push(String(value))
          }
        }
        paramIndex++
      }
      
      // Add updated_at
      setParts.push(`"updated_at" = $${paramIndex}`)
      values.push(new Date().toISOString())
      paramIndex++
      
      // Build final SQL
      const sql = `
        UPDATE site_settings 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `
      
      values.push(1) // id parameter

      console.log('[Contabo] Updating site_settings:', { updateFields, sql, values })

      try {
        const result = await queryContabo<any>(sql, values)

        if (result.rows.length === 0) {
          console.error('[Contabo] Settings not found after update')
          return jsonResponse({ error: "Settings not found" }, 404)
        }

        console.log('[Contabo] Settings updated successfully')
        
        // Parse JSONB columns in the returned data
        const updatedRow = result.rows[0]
        
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
        
        const settings: any = {
          ...updatedRow,
          header_menu: parseJsonb(updatedRow.header_menu, []),
          footer_links: parseJsonb(updatedRow.footer_links, []),
          quick_links: parseJsonb(updatedRow.quick_links, []),
          social_links: parseJsonb(updatedRow.social_links, []),
        }
        
        return jsonResponse(settings)
      } catch (dbError: any) {
        console.error('[Contabo] Database error:', {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint,
          position: dbError.position,
          sql: sql,
          values: values,
        })
        throw dbError
      }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from("site_settings")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select()
      .single()

    if (error) throw error

    return jsonResponse(data)
  } catch (error: any) {
    console.error("[admin] Error updating settings:", error)
    console.error("[admin] Error stack:", error.stack)
    console.error("[admin] Error code:", error.code)
    return jsonResponse({ 
      error: "Failed to update settings",
      details: error.message,
      code: error.code,
      hint: error.hint
    }, 500)
  }
})
