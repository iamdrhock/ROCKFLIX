/**
 * API endpoint to trigger cross-domain sync to TalkFlix
 * Called after successful login on Rockflix
 */

import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Trigger sync to TalkFlix using iframe approach
    const talkflixUrl = process.env.NEXT_PUBLIC_COMMUNITY_URL || "https://talkflix.org"
    const syncUrl = `${talkflixUrl}/api/auth/cross-domain-sync?userId=${encodeURIComponent(session.user.id)}&email=${encodeURIComponent(session.user.email)}&from=rockflix`
    
    return NextResponse.json({
      success: true,
      syncUrl,
      message: "Call this URL in an iframe or redirect to sync to TalkFlix",
      userId: session.user.id,
      email: session.user.email,
    })
  } catch (error: any) {
    console.error("[API] Error syncing to TalkFlix:", error)
    return NextResponse.json(
      { error: "Failed to sync", details: error?.message },
      { status: 500 }
    )
  }
}

