import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"
import bcrypt from "bcryptjs"

/**
 * Complete Profile API Route
 * Handles profile completion for NextAuth users
 * Called from client component to avoid using server-only code in client
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getAuthSession()

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userEmail = session.user.email

    // Parse request body
    const body = await request.json()
    const { username, password, country, profilePictureUrl } = body

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

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

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10)

    console.log("[NextAuth] Creating profile with email:", userEmail)

    // Create profile in Contabo
    await pool.query(
      `INSERT INTO profiles (id, username, email, password_hash, country, profile_picture_url, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'regular', NOW())
       ON CONFLICT (id) DO UPDATE
       SET username = EXCLUDED.username,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           country = EXCLUDED.country,
           profile_picture_url = EXCLUDED.profile_picture_url`,
      [userId, username, userEmail, passwordHash, country || null, profilePictureUrl || null]
    )

    // Ensure user exists in nextauth_users and update name
    await pool.query(
      `INSERT INTO nextauth_users (id, email, name, email_verified, image, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, email = EXCLUDED.email, image = EXCLUDED.image, updated_at = NOW()`,
      [userId, userEmail, username, profilePictureUrl || null]
    )

    // Create credential account for NextAuth (if it doesn't exist)
    await pool.query(
      `INSERT INTO nextauth_accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
       SELECT gen_random_uuid()::TEXT, $1, 'credentials', 'credentials', $1, NOW(), NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM nextauth_accounts WHERE user_id = $1 AND provider = 'credentials'
       )`,
      [userId]
    )

    console.log("[NextAuth] Profile completed successfully")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[NextAuth] Profile completion error:", error)
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
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { exists: false },
        { status: 200 }
      )
    }

    const pool = getContaboPool()
    const profileCheck = await pool.query(
      `SELECT username FROM profiles WHERE id = $1 LIMIT 1`,
      [session.user.id]
    )

    return NextResponse.json({
      exists: profileCheck.rows.length > 0 && !!profileCheck.rows[0].username,
    })
  } catch (error: any) {
    console.error("[NextAuth] Profile check error:", error)
    return NextResponse.json(
      { exists: false, error: error.message },
      { status: 500 }
    )
  }
}


