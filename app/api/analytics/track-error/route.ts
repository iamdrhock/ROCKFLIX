import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { trackPlayerErrorInContabo } from "@/lib/database/contabo-writes"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      movie_id,
      user_id,
      session_id,
      player_used,
      error_type,
      error_message,
      device_type,
      browser,
    } = body

    if (!movie_id || !session_id || !player_used || !error_type) {
      return NextResponse.json(
        { error: "movie_id, session_id, player_used, and error_type are required" },
        { status: 400 }
      )
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      // Track error in Contabo
      await trackPlayerErrorInContabo({
        movie_id,
        user_id: user_id || null,
        session_id,
        player_used,
        error_type,
        error_message: error_message || null,
        device_type: device_type || null,
        browser: browser || null,
      })

      return NextResponse.json({ success: true })
    }

    // Fallback to Supabase
    const supabase = await createClient()
    
    await supabase.from("player_errors").insert({
      movie_id,
      user_id: user_id || null,
      session_id,
      player_used,
      error_type,
      error_message: error_message || null,
      device_type: device_type || null,
      browser: browser || null,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[analytics] Error tracking player error:", error)
    return NextResponse.json(
      { error: "Failed to track player error" },
      { status: 500 }
    )
  }
}

