/**
 * API endpoint to trigger cross-domain sync to Rockflix
 * Called after successful login on TalkFlix
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()
    
    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 })
    }

    // Verify the user is authenticated via Supabase
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Trigger sync to Rockflix using iframe approach
    const rockflixUrl = process.env.NEXT_PUBLIC_MOVIES_URL || "https://rockflix.tv"
    const syncUrl = `${rockflixUrl}/api/auth/cross-domain-sync?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&from=talkflix`
    
    return NextResponse.json({
      success: true,
      syncUrl,
      message: "Call this URL in an iframe or redirect to sync to Rockflix",
      userId,
      email,
    })
  } catch (error: any) {
    console.error("[API] Error syncing to Rockflix:", error)
    return NextResponse.json(
      { error: "Failed to sync", details: error?.message },
      { status: 500 }
    )
  }
}

