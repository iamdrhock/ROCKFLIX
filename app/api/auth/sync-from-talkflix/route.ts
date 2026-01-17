/**
 * API endpoint to sync Supabase session to NextAuth
 * Called by TalkFlix when a user logs in there
 */

import { NextResponse } from "next/server"
import { getContaboPool } from "@/lib/database/contabo-pool"
import { getServerSession } from "next-auth"
import { nextAuthOptions } from "@/lib/auth/nextauth-config"
import { signIn } from "next-auth/react"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 })
    }

    // Verify the user exists in our database
    const pool = getContaboPool()
    const result = await pool.query(
      "SELECT id, email, username FROM profiles WHERE id = $1 AND email = $2 LIMIT 1",
      [userId, email]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = result.rows[0]

    // Create a NextAuth session for this user
    // We'll use a special sync token that can be exchanged for a session
    const syncToken = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      username: user.username,
      timestamp: Date.now(),
      source: 'talkflix'
    })).toString('base64')

    // Return the sync token and a URL to exchange it for a session
    return NextResponse.json({
      success: true,
      syncToken,
      exchangeUrl: `/api/auth/exchange-sync-token?token=${encodeURIComponent(syncToken)}`,
      message: "Sync token generated. Call the exchange URL to create a session."
    })
  } catch (error: any) {
    console.error("[API] Error syncing from TalkFlix:", error)
    return NextResponse.json(
      { error: "Failed to sync session", details: error?.message },
      { status: 500 }
    )
  }
}

