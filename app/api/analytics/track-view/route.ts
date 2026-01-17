import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { trackViewInContabo, incrementMovieViewsContabo } from "@/lib/database/contabo-writes"

export async function POST(request: NextRequest) {
  try {
    console.log("[analytics/track-view] API called")
    const body = await request.json()
    console.log("[analytics/track-view] Request body:", body)
    
    const {
      movie_id,
      user_id,
      session_id,
      view_duration,
      completion_percentage,
      player_used,
      device_type,
      browser,
    } = body

    if (!movie_id || !session_id) {
      console.error("[analytics/track-view] Missing required fields:", { movie_id, session_id })
      return NextResponse.json(
        { error: "movie_id and session_id are required" },
        { status: 400 }
      )
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'
    console.log("[analytics/track-view] Using Contabo:", useContabo)

    if (useContabo) {
      console.log("[analytics/track-view] Tracking view in Contabo for movie:", movie_id)
      
      // Track view in Contabo
      await trackViewInContabo({
        movie_id,
        user_id: user_id || null,
        session_id,
        view_duration: view_duration || null,
        completion_percentage: completion_percentage || null,
        player_used: player_used || null,
        device_type: device_type || null,
        browser: browser || null,
      })

      console.log("[analytics/track-view] View tracked, incrementing counter for movie:", movie_id)
      
      // Increment movie views counter in Contabo
      await incrementMovieViewsContabo(movie_id)

      console.log("[analytics/track-view] Successfully tracked view and incremented counter")
      return NextResponse.json({ success: true })
    }

    // Fallback to Supabase
    const supabase = await createClient()
    
    await supabase.from("view_analytics").insert({
      movie_id,
      user_id: user_id || null,
      session_id,
      view_duration: view_duration || null,
      completion_percentage: completion_percentage || null,
      player_used: player_used || null,
      device_type: device_type || null,
      browser: browser || null,
    })

    // Also increment the movie views counter
    await supabase.rpc("increment_movie_views", { movie_id })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[analytics/track-view] Error tracking view:", error)
    console.error("[analytics/track-view] Error message:", error?.message)
    console.error("[analytics/track-view] Error code:", error?.code)
    console.error("[analytics/track-view] Error detail:", error?.detail)
    console.error("[analytics/track-view] Error stack:", error?.stack)
    return NextResponse.json(
      { 
        error: "Failed to track view",
        details: error?.message || String(error),
        code: error?.code
      },
      { status: 500 }
    )
  }
}

