import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getContaboPool } from "@/lib/database/contabo-pool"

/**
 * Profile API Route for TalkFlix (Supabase Auth)
 * Handles profile updates for Supabase auth users
 * Stores profile data in Contabo database when enabled
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const pool = getContaboPool()
      const result = await pool.query(
        `SELECT username, country, profile_picture_url, about FROM profiles WHERE id = $1 LIMIT 1`,
        [user.id]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 })
      }

      return NextResponse.json({ profile: result.rows[0] })
    }

    // Fallback to Supabase
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("username, country, profile_picture_url, about")
      .eq("id", user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error("[TalkFlix] Error fetching profile:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { username, country, profile_picture_url, about } = body

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      )
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const pool = getContaboPool()

      // Check if username is already taken by another user
      const usernameCheck = await pool.query(
        "SELECT id FROM profiles WHERE username = $1 AND id != $2 LIMIT 1",
        [username, user.id]
      )

      if (usernameCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        )
      }

      // Update profile in Contabo
      await pool.query(
        `UPDATE profiles 
         SET username = $1, 
             country = $2, 
             about = $3, 
             profile_picture_url = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [username, country || null, about || null, profile_picture_url || null, user.id]
      )

      return NextResponse.json({ success: true, message: "Profile updated successfully" })
    }

    // Fallback to Supabase
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        username,
        country,
        profile_picture_url,
        about,
      })
      .eq("id", user.id)

    if (profileError) {
      if (profileError.code === "23505") {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: profileError.message || "Failed to update profile" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" })
  } catch (error: any) {
    console.error("[TalkFlix] Error updating profile:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

