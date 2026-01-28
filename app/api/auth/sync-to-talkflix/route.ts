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
    
    const userId = (session?.user as { id?: string | null; email?: string | null } | null)?.id || null
    const userEmail = (session?.user as { email?: string | null } | null)?.email || null
    if (!userId || !userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Trigger sync to TalkFlix using iframe approach
    const talkflixUrl = process.env.NEXT_PUBLIC_COMMUNITY_URL || "https://talkflix.org"
    const syncUrl = `${talkflixUrl}/api/auth/cross-domain-sync?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(userEmail)}&from=rockflix`
    
    return NextResponse.json({
      success: true,
      syncUrl,
      message: "Call this URL in an iframe or redirect to sync to TalkFlix",
      userId,
      email: userEmail,
    })
  } catch (error: any) {
    console.error("[API] Error syncing to TalkFlix:", error)
    return NextResponse.json(
      { error: "Failed to sync", details: error?.message },
      { status: 500 }
    )
  }
}

