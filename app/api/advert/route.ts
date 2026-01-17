import { NextResponse } from "next/server"

// Public API route for fetching adverts (used by Advert component)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get("position")

    if (!position || !["header", "detail", "watch"].includes(position)) {
      return NextResponse.json({ is_active: false, content: "" })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        const sql = `
          SELECT content, is_active
          FROM advertisements
          WHERE position = $1
          LIMIT 1
        `
        const result = await queryContabo<{ content: string | null; is_active: boolean }>(sql, [position])
        
        if (result.rows.length === 0) {
          return NextResponse.json({ is_active: false, content: "" })
        }

        const row = result.rows[0]
        
        // Check if active AND has content
        if (!row.is_active || !row.content || row.content.trim().length === 0) {
          return NextResponse.json({ is_active: false, content: "" })
        }

        return NextResponse.json({
          content: row.content.trim(),
          is_active: row.is_active || false,
        })
      } catch (error: any) {
        console.error("[api/advert] Contabo error:", error)
        return NextResponse.json({ is_active: false, content: "" })
      }
    }

    // Fallback to Supabase
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("advertisements")
      .select("content, is_active")
      .eq("position", position)
      .eq("is_active", true)
      .maybeSingle()

    if (error || !data || !data.content || data.content.trim().length === 0) {
      return NextResponse.json({ is_active: false, content: "" })
    }

    return NextResponse.json({
      content: data.content.trim(),
      is_active: data.is_active || false,
    })
  } catch (error: any) {
    console.error("[api/advert] Error:", error)
    return NextResponse.json({ is_active: false, content: "" })
  }
}

