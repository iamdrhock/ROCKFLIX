import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getContaboPool } from "@/lib/database/contabo-pool"
import bcrypt from "bcryptjs"

/**
 * Complete Profile API Route for TalkFlix (Supabase Auth)
 * Handles profile completion for Supabase auth users
 * Stores profile data in Contabo database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated via Supabase
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = user.id
    const userEmail = user.email

    // Parse request body
    const body = await request.json()
    const { username, password, country, profilePictureUrl } = body

    // Validate input
    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      )
    }

    // Use Contabo if enabled, otherwise fallback to Supabase
    if (process.env.USE_CONTABO_DB === 'true') {
      const pool = getContaboPool()

      // Check if username is already taken
      const usernameCheck = await pool.query(
        `SELECT id FROM profiles WHERE username = $1 LIMIT 1`,
        [username]
      )

      if (usernameCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        )
      }

      // Hash password if provided
      let passwordHash = null
      if (password) {
        passwordHash = await bcrypt.hash(password, 10)
      }

      console.log("[TalkFlix] Creating profile in Contabo with email:", userEmail)

      // Create profile in Contabo
      await pool.query(
        `INSERT INTO profiles (id, username, email, password_hash, country, profile_picture_url, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'regular', NOW())
         ON CONFLICT (id) DO UPDATE
         SET username = EXCLUDED.username,
             email = EXCLUDED.email,
             password_hash = COALESCE(EXCLUDED.password_hash, profiles.password_hash),
             country = EXCLUDED.country,
             profile_picture_url = EXCLUDED.profile_picture_url`,
        [userId, username, userEmail, passwordHash, country || null, profilePictureUrl || null]
      )

      console.log("[TalkFlix] Profile created successfully in Contabo")
      return NextResponse.json({ success: true })
    }

    // Fallback to Supabase
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      )
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      username,
      email: userEmail,
      country,
      profile_picture_url: profilePictureUrl,
      role: "regular",
    })

    if (profileError) {
      console.error("[TalkFlix] Error creating profile:", profileError)
      return NextResponse.json(
        { error: profileError.message || "Failed to create profile" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[TalkFlix] Profile completion error:", error)
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    )
  }
}

/**
 * Check if profile exists
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
        { exists: false },
        { status: 200 }
      )
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const pool = getContaboPool()
      const profileCheck = await pool.query(
        `SELECT username FROM profiles WHERE id = $1 LIMIT 1`,
        [user.id]
      )

      return NextResponse.json({
        exists: profileCheck.rows.length > 0 && !!profileCheck.rows[0].username,
      })
    }

    // Fallback to Supabase
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()

    return NextResponse.json({
      exists: !!profile?.username,
    })
  } catch (error: any) {
    console.error("[TalkFlix] Profile check error:", error)
    return NextResponse.json(
      { exists: false, error: error.message },
      { status: 500 }
    )
  }
}

