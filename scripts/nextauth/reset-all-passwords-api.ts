/**
 * API Route to reset all user passwords to "yemisi"
 * This can be called via HTTP POST to /api/admin/auth/reset-passwords
 */

import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getContaboPool } from "@/lib/database/contabo-pool"

export async function POST() {
  try {
    const pool = getContaboPool()
    const newPassword = "yemisi"
    
    // Hash the password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)
    
    console.log(`[Password Reset] Resetting all passwords to: ${newPassword}`)
    
    // Get all users from profiles table
    const usersResult = await pool.query(`
      SELECT id, username, email 
      FROM profiles 
      ORDER BY created_at
    `)
    
    console.log(`[Password Reset] Found ${usersResult.rows.length} users`)
    
    // Update all users with the new password hash
    const updateResult = await pool.query(`
      UPDATE profiles 
      SET password_hash = $1 
      WHERE id IS NOT NULL
      RETURNING id, username, email
    `, [hashedPassword])
    
    console.log(`[Password Reset] Updated ${updateResult.rows.length} users`)
    
    return NextResponse.json({
      success: true,
      message: `Reset ${updateResult.rows.length} user passwords to "${newPassword}"`,
      usersUpdated: updateResult.rows.length,
      users: updateResult.rows.map(u => ({
        id: u.id,
        username: u.username || u.email,
        email: u.email
      }))
    })
    
  } catch (error: any) {
    console.error("[Password Reset] ERROR:", error)
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to reset passwords"
    }, { status: 500 })
  }
}

