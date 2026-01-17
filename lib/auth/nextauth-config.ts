/**
 * NextAuth.js Configuration
 * 
 * This file configures NextAuth.js for use with Contabo PostgreSQL
 * Phase 1: Setup only - not yet active (Supabase Auth still in use)
 */

import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { getContaboPool } from "@/lib/database/contabo-pool"
import { randomUUID } from "crypto"


// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "[NextAuth] Missing NEXTAUTH_SECRET environment variable. " +
    "Generate one with: openssl rand -base64 32"
  )
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "[NextAuth] Warning: Google OAuth credentials not set. " +
    "Google sign-in will not work until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured."
  )
}

export const nextAuthOptions: NextAuthOptions = {
  // NO ADAPTER - Pure JWT sessions, handle user storage manually
  // This eliminates all adapter column name issues
  session: {
    strategy: "jwt", // Use JWT sessions only
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          const pool = getContaboPool()
          
          // Find user by username in profiles table (existing Supabase structure)
          // Also check if user exists in users table for NextAuth
          const result = await pool.query(
            `SELECT 
              p.id, 
              p.email, 
              p.password_hash,
              p.username,
              CASE WHEN u.id IS NOT NULL THEN true ELSE false END as is_migrated
             FROM profiles p
             LEFT JOIN users u ON u.id = p.id::TEXT
             WHERE p.username = $1 
             LIMIT 1`,
            [credentials.username]
          )

          if (result.rows.length === 0) {
            console.log(`[NextAuth] User not found: ${credentials.username}`)
            return null
          }

          const user = result.rows[0]
          console.log(`[NextAuth] Found user: ${user.username} (${user.id}), has password: ${!!user.password_hash}`)

          // Verify password
          if (!user.password_hash) {
            console.log(`[NextAuth] User ${user.username} has no password_hash`)
            return null
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          )

          console.log(`[NextAuth] Password check for ${user.username}: ${isValid ? 'VALID' : 'INVALID'}`)

          if (!isValid) {
            // Log first 20 chars of hash for debugging (don't log full hash)
            console.log(`[NextAuth] Password mismatch. Hash prefix: ${user.password_hash.substring(0, 20)}...`)
            return null
          }

          // If user not yet migrated to NextAuth, ensure they exist in users table (using camelCase)
          if (!user.is_migrated) {
            try {
              // Users table uses camelCase: emailVerified, createdAt, updatedAt
              await pool.query(`
                INSERT INTO users (id, email, name, "emailVerified", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, NOW(), NOW(), NOW())
                ON CONFLICT (id) DO UPDATE
                SET email = EXCLUDED.email, name = EXCLUDED.name, "updatedAt" = NOW()
              `, [user.id, user.email, user.username])

              // Check accounts table schema - might be camelCase or snake_case
              const accountsCheck = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'accounts' AND column_name IN ('user_id', 'userId')
                LIMIT 1
              `)
              
              const usesCamelCase = accountsCheck.rows.some((row: any) => row.column_name === 'userId')
              
              if (usesCamelCase) {
                // Accounts table uses camelCase
                await pool.query(`
                  INSERT INTO accounts (id, "userId", type, provider, "providerAccountId", "createdAt", "updatedAt")
                  VALUES (gen_random_uuid()::TEXT, $1, 'credentials', 'credentials', $1, NOW(), NOW())
                  ON CONFLICT (provider, "providerAccountId") DO NOTHING
                `, [user.id])
              } else {
                // Accounts table uses snake_case
                await pool.query(`
                  INSERT INTO accounts (id, user_id, type, provider, provider_account_id, created_at, updated_at)
                  VALUES (gen_random_uuid()::TEXT, $1, 'credentials', 'credentials', $1, NOW(), NOW())
                  ON CONFLICT (provider, provider_account_id) DO NOTHING
                `, [user.id])
              }
              
              console.log(`[NextAuth] Auto-migrated user ${user.username} to NextAuth during login`)
            } catch (migrationError: any) {
              console.error(`[NextAuth] Failed to auto-migrate user ${user.username}:`, migrationError?.message || migrationError)
              // Continue with login even if migration fails - user can still log in
            }
          }

          // Return user object compatible with NextAuth
          return {
            id: user.id,
            email: user.email,
            name: user.username,
          }
        } catch (error) {
          console.error("[NextAuth] Credentials authorize error:", error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
        ? `__Secure-next-auth.session-token` 
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Don't set domain - let browser handle it for current domain
        // This ensures cookies work for both rockflix.tv and talkflix.org
        // Each domain will get its own cookie
      },
    },
  },
  // Make NEXTAUTH_URL dynamic - use the request host
  // This is handled automatically by NextAuth v4, but we can set it explicitly
  // The URL will be determined from the request headers
  callbacks: {
    async jwt({ token, user, account }) {
      // JWT strategy: Add user ID to token
      // This runs on every request AND on sign-in
      console.log("[NextAuth] JWT callback triggered:", { 
        hasUser: !!user, 
        hasAccount: !!account, 
        hasTokenId: !!token.id,
        tokenEmail: token?.email
      })
      
      if (user) {
        // User object is provided on sign-in
        // IMPORTANT: user.id might be the providerAccountId (e.g., Google OAuth ID like "108821407589605623670")
        // We need to get the actual UUID from the database, not use the providerAccountId
        // Check if user.id looks like a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id || '')
        
        if (isUUID) {
          // It's already a UUID, use it directly
          token.id = user.id
          token.email = user.email || token.email
          token.name = user.name || token.name
          console.log("[NextAuth] JWT callback: Set token from user (UUID):", { id: user.id, email: user.email, name: user.name })
        } else {
          // It's not a UUID - likely a providerAccountId (e.g., Google OAuth ID)
          // We need to look it up in the database to get the actual user UUID
          console.log("[NextAuth] JWT callback: user.id is not a UUID (likely providerAccountId), looking up in database:", user.id)
          try {
            const pool = getContaboPool()
            // Look up user by email (more reliable than providerAccountId)
            if (user.email) {
              const emailResult = await pool.query(
                `SELECT id, name FROM users WHERE email = $1 LIMIT 1`,
                [user.email]
              )
              if (emailResult.rows.length > 0) {
                token.id = emailResult.rows[0].id
                token.email = user.email
                token.name = emailResult.rows[0].name || user.name
                console.log("[NextAuth] JWT callback: Found user UUID from email:", { id: token.id, email: token.email })
              } else {
                console.error("[NextAuth] JWT callback: Could not find user with email:", user.email)
                // Fallback: use the providerAccountId as-is (will cause UUID error later, but better than breaking login)
                token.id = user.id
                token.email = user.email || token.email
                token.name = user.name || token.name
              }
            } else {
              // No email - use providerAccountId as fallback (will cause error, but better than breaking)
              console.error("[NextAuth] JWT callback: No email provided, using providerAccountId as fallback:", user.id)
              token.id = user.id
              token.email = token.email
              token.name = user.name || token.name
            }
          } catch (error) {
            console.error("[NextAuth] JWT callback: Error looking up user UUID:", error)
            // Fallback: use providerAccountId (will cause UUID error, but better than breaking login)
            token.id = user.id
            token.email = user.email || token.email
            token.name = user.name || token.name
          }
        }
      }
      
      // If account exists (OAuth sign-in), ensure user ID is set
      if (account && !token.id) {
        try {
          const pool = getContaboPool()
          // Check if accounts table uses camelCase or snake_case
          const accountsCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'accounts' AND column_name IN ('user_id', 'userId')
            LIMIT 1
          `)
          
          const usesCamelCase = accountsCheck.rows.some((row: any) => row.column_name === 'userId')
          
          let accountResult
          if (usesCamelCase) {
            // Accounts table uses camelCase
            accountResult = await pool.query(
              `SELECT u.id, u.email, u.name FROM users u
               JOIN accounts a ON u.id = a."userId"
               WHERE a.provider = $1 AND a."providerAccountId" = $2 LIMIT 1`,
              [account.provider, account.providerAccountId]
            )
          } else {
            // Accounts table uses snake_case
            accountResult = await pool.query(
              `SELECT u.id, u.email, u.name FROM users u
               JOIN accounts a ON u.id = a.user_id
               WHERE a.provider = $1 AND a.provider_account_id = $2 LIMIT 1`,
              [account.provider, account.providerAccountId]
            )
          }
          
          if (accountResult.rows.length > 0) {
            token.id = accountResult.rows[0].id
            token.email = accountResult.rows[0].email
            token.name = accountResult.rows[0].name
            console.log("[NextAuth] JWT callback: Set token from account:", { id: token.id, email: token.email })
          } else if (token.email) {
            // Fallback to email lookup
            const emailResult = await pool.query(
              `SELECT id, name FROM users WHERE email = $1 LIMIT 1`,
              [token.email]
            )
            if (emailResult.rows.length > 0) {
              token.id = emailResult.rows[0].id
              token.name = emailResult.rows[0].name
              console.log("[NextAuth] JWT callback: Set token from email lookup:", { id: token.id })
            }
          }
        } catch (error) {
          console.error("[NextAuth] Could not fetch user ID in jwt callback:", error)
        }
      }
      
      // Ensure token always has required fields
      if (!token.id && token.email) {
        console.warn("[NextAuth] JWT callback: Token missing ID but has email:", token.email)
      }
      
      return token
    },
    async session({ session, token }) {
      // JWT strategy: Get user ID from token
      console.log("[NextAuth] Session callback:", { 
        hasToken: !!token, 
        tokenId: token?.id, 
        tokenEmail: token?.email,
        sessionUser: session?.user 
      })
      
      if (token && token.id) {
        session.user.id = token.id as string
      }
      if (token && token.email) {
        session.user.email = token.email as string
      }
      if (token && token.name) {
        session.user.name = token.name as string
      }
      
      console.log("[NextAuth] Session callback result:", { 
        userId: session.user.id, 
        email: session.user.email, 
        name: session.user.name 
      })
      
      return session
    },
    async signIn({ user, account, profile }) {
      // For Google OAuth, manually handle user and account creation
      // Users table uses camelCase, accounts table might be either
      if (account?.provider === "google" && user?.email && account.providerAccountId) {
        try {
          const pool = getContaboPool()
          
          // Check accounts table schema
          const accountsCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'accounts' AND column_name IN ('user_id', 'userId')
            LIMIT 1
          `)
          const usesCamelCase = accountsCheck.rows.some((row: any) => row.column_name === 'userId')
          
          // Check if account link already exists
          let accountCheck
          if (usesCamelCase) {
            accountCheck = await pool.query(
              `SELECT "userId" FROM accounts WHERE provider = $1 AND "providerAccountId" = $2 LIMIT 1`,
              [account.provider, account.providerAccountId]
            )
          } else {
            accountCheck = await pool.query(
              `SELECT user_id FROM accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1`,
              [account.provider, account.providerAccountId]
            )
          }
          
          if (accountCheck.rows.length === 0) {
            // Account link doesn't exist - need to create it
            // First, check if user exists by email
            let userResult = await pool.query(
              `SELECT id FROM users WHERE email = $1 LIMIT 1`,
              [user.email]
            )
            
            let userId: string
            
            if (userResult.rows.length === 0) {
              // User doesn't exist - create user first (using camelCase)
              userId = randomUUID()
              await pool.query(`
                INSERT INTO users (id, email, name, "emailVerified", image, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, NOW(), $4, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
              `, [userId, user.email, user.name || user.email.split("@")[0], user.image || null])
              
              // Also create profile
              await pool.query(`
                INSERT INTO profiles (id, email, username, profile_picture_url, role, created_at)
                VALUES ($1, $2, $3, $4, 'regular', NOW())
                ON CONFLICT (id) DO NOTHING
              `, [userId, user.email, user.name || user.email.split("@")[0], user.image || null])
              
              console.log("[NextAuth] Created new user in signIn callback:", user.email)
            } else {
              userId = userResult.rows[0].id
            }
            
            // Now create the account link
            const expiresAtBigint = account.expires_at ? Math.floor(account.expires_at) : null
            if (usesCamelCase) {
              await pool.query(`
                INSERT INTO accounts (id, "userId", type, provider, "providerAccountId", "accessToken", "expiresAt", "tokenType", scope, "idToken", "createdAt", "updatedAt")
                VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                ON CONFLICT (provider, "providerAccountId") DO UPDATE
                SET "accessToken" = EXCLUDED."accessToken", "expiresAt" = EXCLUDED."expiresAt", "tokenType" = EXCLUDED."tokenType", scope = EXCLUDED.scope, "idToken" = EXCLUDED."idToken", "updatedAt" = NOW()
              `, [
                userId,
                account.type || "oauth",
                account.provider || "google",
                account.providerAccountId,
                account.access_token || null,
                expiresAtBigint,
                account.token_type || null,
                account.scope || null,
                account.id_token || null,
              ])
            } else {
              await pool.query(`
                INSERT INTO accounts (id, user_id, type, provider, provider_account_id, access_token, expires_at, token_type, scope, id_token, created_at, updated_at)
                VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                ON CONFLICT (provider, provider_account_id) DO UPDATE
                SET access_token = EXCLUDED.access_token, expires_at = EXCLUDED.expires_at, token_type = EXCLUDED.token_type, scope = EXCLUDED.scope, id_token = EXCLUDED.id_token, updated_at = NOW()
              `, [
                userId,
                account.type || "oauth",
                account.provider || "google",
                account.providerAccountId,
                account.access_token || null,
                expiresAtBigint,
                account.token_type || null,
                account.scope || null,
                account.id_token || null,
              ])
            }
            console.log("[NextAuth] Created/updated account link in signIn callback:", user.email)
          } else {
            console.log("[NextAuth] Account link already exists:", user.email)
          }
        } catch (error) {
          console.error("[NextAuth] Error in signIn callback:", error)
          // Don't block sign-in
        }
      }
      
      return true
    },
    async redirect({ url, baseUrl }) {
      // After successful login, sync to TalkFlix
      // This is done in the client-side login handlers, not here
      return url.startsWith(baseUrl) ? url : baseUrl
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Enable debug logging
}
