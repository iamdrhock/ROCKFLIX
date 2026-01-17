import { adminRoute } from "@/lib/security/admin-middleware"
import { NextResponse } from "next/server"

const AD_POSITIONS = ["header", "detail", "watch"]

// GET - Fetch all adverts
export const GET = adminRoute(async () => {
  try {
    console.log("[admin/advert] GET - Fetching adverts")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        // Build SQL with position placeholders
        const placeholders = AD_POSITIONS.map((_, i) => `$${i + 1}`).join(', ')
        const sql = `
          SELECT id, position, content, is_active, created_at, updated_at
          FROM advertisements
          WHERE position IN (${placeholders})
          ORDER BY position
        `
        const result = await queryContabo<any>(sql, AD_POSITIONS)
        
        const adsMap = new Map<string, any>()
        for (const ad of result.rows || []) {
          adsMap.set(ad.position, {
            id: ad.id,
            position: ad.position,
            content: ad.content || "",
            is_active: ad.is_active || false,
          })
        }

        // Ensure all positions exist (create missing ones)
        const missingPositions = AD_POSITIONS.filter(pos => !adsMap.has(pos))
        if (missingPositions.length > 0) {
          console.log("[admin/advert] Creating missing positions:", missingPositions)
          for (const position of missingPositions) {
            try {
              const insertSql = `
                INSERT INTO advertisements (position, content, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW())
                RETURNING id, position, content, is_active
              `
              const insertResult = await queryContabo<any>(insertSql, [position, "", false])
              if (insertResult.rows.length > 0) {
                const ad = insertResult.rows[0]
                adsMap.set(position, {
                  id: ad.id,
                  position: ad.position,
                  content: ad.content || "",
                  is_active: ad.is_active || false,
                })
              }
            } catch (insertError: any) {
              console.error(`[admin/advert] Error creating position ${position}:`, insertError)
              adsMap.set(position, {
                position,
                content: "",
                is_active: false,
              })
            }
          }
        }

        // Return adverts in position order
        const adverts = AD_POSITIONS.map(pos => adsMap.get(pos) || {
          position: pos,
          content: "",
          is_active: false,
        })

        return NextResponse.json(adverts)
      } catch (error: any) {
        console.error("[admin/advert] Contabo error:", error)
        // Return default adverts on error
        const defaultAdverts = AD_POSITIONS.map(pos => ({
          position: pos,
          content: "",
          is_active: false,
        }))
        return NextResponse.json(defaultAdverts)
      }
    }

    // Fallback to Supabase
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("advertisements")
      .select("*")
      .in("position", AD_POSITIONS)
      .order("position")

    if (error) {
      console.error("[admin/advert] Supabase error:", error)
      const defaultAdverts = AD_POSITIONS.map(pos => ({
        position: pos,
        content: "",
        is_active: false,
      }))
      return NextResponse.json(defaultAdverts)
    }

    // Ensure all positions exist
    const existingPositions = new Set(data?.map(ad => ad.position) || [])
    const missingPositions = AD_POSITIONS.filter(pos => !existingPositions.has(pos))

    if (missingPositions.length > 0) {
      const newAdverts = missingPositions.map(position => ({
        position,
        content: "",
        is_active: false,
      }))
      await supabase.from("advertisements").insert(newAdverts)
      // Refetch
      const { data: updatedData } = await supabase
        .from("advertisements")
        .select("*")
        .in("position", AD_POSITIONS)
        .order("position")
      return NextResponse.json(updatedData || [])
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error("[admin/advert] GET error:", error)
    const defaultAdverts = AD_POSITIONS.map(pos => ({
      position: pos,
      content: "",
      is_active: false,
    }))
    return NextResponse.json(defaultAdverts)
  }
})

// PUT - Save all adverts
export const PUT = adminRoute(async ({ request }) => {
  try {
    const adverts = await request.json()
    console.log("[admin/advert] PUT - Saving adverts:", adverts.length)

    if (!Array.isArray(adverts)) {
      return NextResponse.json({ error: "Invalid request - expected array" }, { status: 400 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        for (const advert of adverts) {
          if (!advert.position || !AD_POSITIONS.includes(advert.position)) {
            continue
          }

          // Check if advert exists
          const checkSql = `SELECT id FROM advertisements WHERE position = $1 LIMIT 1`
          const checkResult = await queryContabo<{ id: number }>(checkSql, [advert.position])

          if (checkResult.rows.length > 0) {
            // Update existing
            const updateSql = `
              UPDATE advertisements
              SET content = $1, is_active = $2, updated_at = NOW()
              WHERE position = $3
            `
            await queryContabo(updateSql, [
              advert.content || "",
              advert.is_active !== undefined ? advert.is_active : false,
              advert.position
            ])
          } else {
            // Insert new
            const insertSql = `
              INSERT INTO advertisements (position, content, is_active, created_at, updated_at)
              VALUES ($1, $2, $3, NOW(), NOW())
            `
            await queryContabo(insertSql, [
              advert.position,
              advert.content || "",
              advert.is_active !== undefined ? advert.is_active : false
            ])
          }
        }

        return NextResponse.json({ success: true })
      } catch (error: any) {
        console.error("[admin/advert] Contabo save error:", error)
        return NextResponse.json({ error: "Failed to save adverts", details: error.message }, { status: 500 })
      }
    }

    // Fallback to Supabase
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    
    for (const advert of adverts) {
      if (!advert.position || !AD_POSITIONS.includes(advert.position)) {
        continue
      }

      const { data: existing } = await supabase
        .from("advertisements")
        .select("id")
        .eq("position", advert.position)
        .single()

      if (existing) {
        await supabase
          .from("advertisements")
          .update({
            content: advert.content || "",
            is_active: advert.is_active !== undefined ? advert.is_active : false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      } else {
        await supabase.from("advertisements").insert({
          position: advert.position,
          content: advert.content || "",
          is_active: advert.is_active !== undefined ? advert.is_active : false,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[admin/advert] PUT error:", error)
    return NextResponse.json({ error: "Failed to save adverts" }, { status: 500 })
  }
})

