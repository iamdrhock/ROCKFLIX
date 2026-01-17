import { NextResponse } from "next/server"
import { getContaboPool } from "@/lib/database/contabo-pool"
import bcrypt from "bcryptjs"

/**
 * Verify and Reset All User Passwords
 * This endpoint checks all user passwords and resets them to "yemisi" if needed
 */
export async function POST(request: Request) {
  try {
    const pool = getContaboPool()
    const targetPassword = "yemisi"
    const targetHash = "$2a$10$UTw5ysWRZP2OmrFddMfFCeGhPDt9xPq.xHnKKyIGDZow38ZeiGr7a"

    // Step 1: Get all users
    const usersResult = await pool.query(
      `SELECT id, username, email, password_hash 
       FROM profiles 
       ORDER BY username`
    )

    const users = usersResult.rows
    const results = {
      total: users.length,
      checked: [] as any[],
      updated: 0,
      errors: [] as string[],
    }

    // Step 2: Check each user's password
    for (const user of users) {
      const userResult: any = {
        username: user.username,
        email: user.email,
        hasPassword: !!user.password_hash,
        needsUpdate: true,
        status: "",
      }

      if (user.password_hash) {
        // Verify if current password matches "yemisi"
        try {
          const isValid = await bcrypt.compare(targetPassword, user.password_hash)
          if (isValid) {
            userResult.needsUpdate = false
            userResult.status = "Already set to yemisi"
          } else {
            userResult.status = "Different password - will update"
          }
        } catch (error) {
          userResult.status = "Invalid hash format - will update"
        }
      } else {
        userResult.status = "No password - will set"
      }

      // Step 3: Update password if needed
      if (userResult.needsUpdate) {
        try {
          await pool.query(
            `UPDATE profiles 
             SET password_hash = $1 
             WHERE id = $2`,
            [targetHash, user.id]
          )
          userResult.status = "✅ Updated to yemisi"
          results.updated++
        } catch (error: any) {
          userResult.status = `❌ Error: ${error.message}`
          results.errors.push(`${user.username}: ${error.message}`)
        }
      }

      results.checked.push(userResult)
    }

    // Step 4: Verify specific user "icon"
    const iconUser = await pool.query(
      `SELECT id, username, email, password_hash 
       FROM profiles 
       WHERE username = $1 
       LIMIT 1`,
      ["icon"]
    )

    let iconStatus = "User 'icon' not found"
    if (iconUser.rows.length > 0) {
      const icon = iconUser.rows[0]
      if (icon.password_hash) {
        const isValid = await bcrypt.compare(targetPassword, icon.password_hash)
        iconStatus = isValid 
          ? "✅ User 'icon' password is correctly set to 'yemisi'" 
          : "❌ User 'icon' password does NOT match 'yemisi'"
      } else {
        iconStatus = "❌ User 'icon' has no password set"
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${results.total} users, updated ${results.updated} passwords`,
      iconStatus,
      results,
    })
  } catch (error: any) {
    console.error("[Password Reset] Error:", error)
    return NextResponse.json(
      { error: "Failed to verify/reset passwords", details: error.message },
      { status: 500 }
    )
  }
}

