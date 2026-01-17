/**
 * Reset all user passwords to "yemisi"
 * This script will hash the password and update all users in the profiles table
 */

import bcrypt from "bcryptjs"
import { getContaboPool } from "@/lib/database/contabo-pool"

async function resetAllPasswords() {
  const pool = getContaboPool()
  const newPassword = "yemisi"
  
  // Hash the password
  const saltRounds = 10
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds)
  
  console.log(`[Password Reset] Hashing password: ${newPassword}`)
  console.log(`[Password Reset] Hashed password: ${hashedPassword}`)
  
  try {
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
    console.log(`[Password Reset] Updated users:`)
    updateResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username || user.email} (ID: ${user.id})`)
    })
    
    console.log(`\n[Password Reset] ✅ SUCCESS! All passwords reset to: ${newPassword}`)
    console.log(`[Password Reset] You can now login with any username and password: ${newPassword}`)
    
  } catch (error) {
    console.error("[Password Reset] ❌ ERROR:", error)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the script
resetAllPasswords()
  .then(() => {
    console.log("\n[Password Reset] Script completed")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n[Password Reset] Script failed:", error)
    process.exit(1)
  })

