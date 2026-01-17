/**
 * NextAuth.js Client Helper Functions
 * Utilities for working with NextAuth in Client Components
 */

"use client"

import { signIn, signOut, useSession } from "next-auth/react"

/**
 * Sign in with credentials (username/password)
 */
export async function loginWithCredentials(username: string, password: string) {
  const result = await signIn("credentials", {
    username,
    password,
    redirect: false,
  })
  return result
}

/**
 * Sign in with Google OAuth
 */
export async function loginWithGoogle(redirectTo?: string) {
  const callbackUrl = redirectTo || "/"
  await signIn("google", {
    callbackUrl,
  })
}

/**
 * Sign out the current user
 */
export async function logout() {
  await signOut({
    redirect: true,
    callbackUrl: "/",
  })
}

/**
 * React hook to get session in Client Components
 * Returns the same object as useSession from next-auth/react
 */
export function useAuth() {
  const { data: session, status } = useSession()
  return {
    user: session?.user,
    userId: session?.user?.id || null,
    isAuthenticated: !!session?.user,
    isLoading: status === "loading",
    session,
  }
}


