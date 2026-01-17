import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { trackSearchInContabo } from "@/lib/database/contabo-writes"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      user_id,
      session_id,
      results_count,
      clicked_result_id,
      device_type,
    } = body

    if (!query || !session_id) {
      return NextResponse.json(
        { error: "query and session_id are required" },
        { status: 400 }
      )
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      // Track search in Contabo
      await trackSearchInContabo({
        query,
        user_id: user_id || null,
        session_id,
        results_count: results_count || null,
        clicked_result_id: clicked_result_id || null,
        device_type: device_type || null,
      })

      return NextResponse.json({ success: true })
    }

    // Fallback to Supabase
    const supabase = await createClient()
    
    await supabase.from("search_analytics").insert({
      query,
      user_id: user_id || null,
      session_id,
      results_count: results_count || null,
      clicked_result_id: clicked_result_id || null,
      device_type: device_type || null,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[analytics] Error tracking search:", error)
    return NextResponse.json(
      { error: "Failed to track search" },
      { status: 500 }
    )
  }
}

