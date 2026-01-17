import { NextRequest, NextResponse } from "next/server"
import { adminRoute } from "@/lib/security/admin-middleware"
import { getContaboPool } from "@/lib/database/contabo-pool"
import { createServiceRoleClient } from "@/lib/supabase/server"

interface MigrationStats {
  totalProfiles: number
  migratedUsers: number
  credentialAccounts: number
  oauthAccounts: number
  errors: string[]
  warnings: string[]
}

/**
 * Phase 2: User Migration API
 * Migrates users from Supabase Auth to NextAuth.js
 * 
 * This API route:
 * 1. Syncs users from profiles table to nextauth_users
 * 2. Creates credential accounts for users with password_hash
 * 3. Optionally migrates OAuth accounts (if accessible)
 * 4. Returns migration statistics
 */
export const POST = adminRoute(async (request: NextRequest) => {
  const pool = getContaboPool()
  const stats: MigrationStats = {
    totalProfiles: 0,
    migratedUsers: 0,
    credentialAccounts: 0,
    oauthAccounts: 0,
    errors: [],
    warnings: [],
  }

  try {
    console.log("[Phase 2] Starting user migration from Supabase to NextAuth...")

    // Step 1: Get total profiles count
    const profilesCount = await pool.query(
      `SELECT COUNT(*) as count FROM profiles WHERE email IS NOT NULL`
    )
    stats.totalProfiles = parseInt(profilesCount.rows[0].count)

    console.log(`[Phase 2] Found ${stats.totalProfiles} profiles with email`)

    // Step 2: Migrate users from profiles to nextauth_users
    const migrateUsers = await pool.query(`
      INSERT INTO nextauth_users (id, email, name, email_verified, image, created_at, updated_at)
      SELECT 
          p.id::TEXT,
          p.email,
          p.username,
          CASE WHEN p.email IS NOT NULL THEN NOW() ELSE NULL END,
          p.profile_picture_url,
          p.created_at,
          p.created_at  -- profiles table doesn't have updated_at, use created_at
      FROM profiles p
      WHERE p.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM nextauth_users nu WHERE nu.id = p.id::TEXT
        )
      ON CONFLICT (id) DO UPDATE
      SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          image = EXCLUDED.image,
          updated_at = NOW()
      RETURNING id
    `)

    stats.migratedUsers = migrateUsers.rowCount || 0
    console.log(`[Phase 2] Migrated ${stats.migratedUsers} users to nextauth_users`)

    // Step 3: Create credential accounts for users with password_hash
    const migrateCredentials = await pool.query(`
      INSERT INTO nextauth_accounts (
          id, 
          user_id, 
          type, 
          provider, 
          provider_account_id, 
          created_at, 
          updated_at
      )
      SELECT 
          uuid_generate_v4()::TEXT,
          p.id::TEXT,
          'credentials',
          'credentials',
          p.id::TEXT,
          p.created_at,
          p.created_at  -- profiles table doesn't have updated_at, use created_at
      FROM profiles p
      WHERE p.password_hash IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM nextauth_accounts na 
          WHERE na.user_id = p.id::TEXT 
            AND na.provider = 'credentials'
        )
      ON CONFLICT (provider, provider_account_id) DO NOTHING
      RETURNING id
    `)

    stats.credentialAccounts = migrateCredentials.rowCount || 0
    console.log(`[Phase 2] Created ${stats.credentialAccounts} credential accounts`)

    // Step 4: Check for users without passwords (likely OAuth only)
    const oauthOnlyUsers = await pool.query(`
      SELECT COUNT(*) as count
      FROM profiles p
      WHERE p.email IS NOT NULL
        AND p.password_hash IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM nextauth_accounts na 
          WHERE na.user_id = p.id::TEXT
        )
    `)

    const oauthCount = parseInt(oauthOnlyUsers.rows[0].count)
    if (oauthCount > 0) {
      stats.warnings.push(
        `Found ${oauthCount} users without passwords (likely OAuth-only). These users will need to link their OAuth accounts when NextAuth is enabled.`
      )
    }

    // Step 5: Get final counts
    const finalStats = await pool.query(`
      SELECT 
          (SELECT COUNT(*) FROM nextauth_users) as nextauth_users_count,
          (SELECT COUNT(*) FROM nextauth_accounts WHERE provider = 'credentials') as credentials_count,
          (SELECT COUNT(*) FROM nextauth_accounts WHERE provider != 'credentials') as oauth_count
    `)

    stats.migratedUsers = parseInt(finalStats.rows[0].nextauth_users_count)
    stats.credentialAccounts = parseInt(finalStats.rows[0].credentials_count)
    stats.oauthAccounts = parseInt(finalStats.rows[0].oauth_count)

    console.log(`[Phase 2] Migration complete:`)
    console.log(`  - NextAuth users: ${stats.migratedUsers}`)
    console.log(`  - Credential accounts: ${stats.credentialAccounts}`)
    console.log(`  - OAuth accounts: ${stats.oauthAccounts}`)

    return NextResponse.json({
      success: true,
      message: "User migration completed successfully",
      stats,
    })
  } catch (error: any) {
    console.error("[Phase 2] Migration error:", error)
    stats.errors.push(error.message || "Unknown error occurred")

    return NextResponse.json(
      {
        success: false,
        message: "Migration failed",
        stats,
        error: error.message,
      },
      { status: 500 }
    )
  }
})

/**
 * GET endpoint to check migration status
 */
export const GET = adminRoute(async () => {
  const pool = getContaboPool()

  try {
    const stats = await pool.query(`
      SELECT 
          (SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL) as total_profiles,
          (SELECT COUNT(*) FROM nextauth_users) as nextauth_users,
          (SELECT COUNT(*) FROM nextauth_accounts WHERE provider = 'credentials') as credentials_accounts,
          (SELECT COUNT(*) FROM nextauth_accounts WHERE provider != 'credentials') as oauth_accounts,
          (SELECT COUNT(*) FROM profiles 
           WHERE email IS NOT NULL 
           AND id NOT IN (SELECT id::UUID FROM nextauth_users)) as unmigrated_users,
          (SELECT COUNT(*) FROM profiles 
           WHERE password_hash IS NOT NULL 
           AND id NOT IN (
             SELECT user_id::UUID FROM nextauth_accounts WHERE provider = 'credentials'
           )) as unmigrated_credentials
    `)

    const data = stats.rows[0]

    return NextResponse.json({
      success: true,
      stats: {
        totalProfiles: parseInt(data.total_profiles),
        nextauthUsers: parseInt(data.nextauth_users),
        credentialAccounts: parseInt(data.credentials_accounts),
        oauthAccounts: parseInt(data.oauth_accounts),
        unmigratedUsers: parseInt(data.unmigrated_users),
        unmigratedCredentials: parseInt(data.unmigrated_credentials),
        migrationStatus: parseInt(data.unmigrated_users) === 0 ? "complete" : "pending",
      },
    })
  } catch (error: any) {
    console.error("[Phase 2] Error checking migration status:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
})


