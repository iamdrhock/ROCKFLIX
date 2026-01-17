/**
 * NextAuth.js Helper Functions
 * Utilities for working with NextAuth sessions and authentication
 * 
 * Note: NextAuth v4 uses getServerSession
 */

import { getServerSession } from "next-auth/next"
import { nextAuthOptions } from "@/lib/auth/nextauth-config"

/**
 * Get the current server session with timeout protection
 * Use this in Server Components and API routes
 * 
 * In API routes, we need to pass headers to getServerSession
 */
export async function getAuthSession() {
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 3000) // 3 second timeout
    })

    const sessionPromise = getServerSession(nextAuthOptions)
    
    // Race between session fetch and timeout
    return await Promise.race([sessionPromise, timeoutPromise])
  } catch (error) {
    console.error("[getAuthSession] Error getting session:", error)
    return null
  }
}

/**
 * Get the current user ID from session
 * Returns null if not authenticated
 */
export async function getUserId(): Promise<string | null> {
  const session = await getAuthSession()
  return session?.user?.id || null
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getAuthSession()
  return !!session?.user
}

/**
 * Require authentication - throws error if not authenticated
 * Use in Server Components that require auth
 */
export async function requireAuth(): Promise<{ id: string; email: string | null; name: string | null }> {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    throw new Error("Authentication required")
  }
  return {
    id: session.user.id,
    email: session.user.email || null,
    name: session.user.name || null,
  }
}

