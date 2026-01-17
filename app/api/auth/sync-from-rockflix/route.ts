/**
 * API endpoint to sync NextAuth session to Supabase
 * Called by Rockflix when a user logs in there
 */

import { NextResponse } from "next/server"
import { getContaboPool } from "@/lib/database/contabo-pool"
import { createServiceRoleClient } from "@/lib/supabase/server"

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
      "SELECT id, email FROM profiles WHERE id = $1 AND email = $2 LIMIT 1",
      [userId, email]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // For Supabase, we need to create a magic link or password reset token
    // Actually, since both share the same profiles table, we can just return success
    // The client will handle creating the Supabase session by using the credentials
    
    return NextResponse.json({
      success: true,
      message: "User verified. Client should create Supabase session using credentials.",
      userId,
      email
    })
  } catch (error: any) {
    console.error("[API] Error syncing from Rockflix:", error)
    return NextResponse.json(
      { error: "Failed to sync session", details: error?.message },
      { status: 500 }
    )
  }
}

