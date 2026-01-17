import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Get user's current password hash from profiles table
    const pool = getContaboPool()
    const result = await pool.query(
      "SELECT password_hash FROM profiles WHERE id = $1 LIMIT 1",
      [session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const profile = result.rows[0]

    // If user has no password (OAuth-only account), check if they're trying to set one
    if (!profile.password_hash) {
      // OAuth-only users can set a password without providing current password
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await pool.query(
        "UPDATE profiles SET password_hash = $1 WHERE id = $2",
        [hashedPassword, session.user.id]
      )
      return NextResponse.json({ success: true, message: "Password set successfully" })
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, profile.password_hash)

    if (!isValidPassword) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await pool.query(
      "UPDATE profiles SET password_hash = $1 WHERE id = $2",
      [hashedPassword, session.user.id]
    )

    // Also update NextAuth users table if it exists
    try {
      await pool.query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hashedPassword, session.user.id]
      )
    } catch (error) {
      // Ignore if users table doesn't exist or doesn't have password column
      console.log("[Change Password] Could not update users table:", error)
    }

    return NextResponse.json({ success: true, message: "Password changed successfully" })
  } catch (error) {
    console.error("[Change Password] Error:", error)
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    )
  }
}

