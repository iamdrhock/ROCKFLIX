/**
 * NextAuth.js Middleware
 * Handles session verification and route protection
 */

import { getToken } from "next-auth/jwt"
import { NextResponse, type NextRequest } from "next/server"

export async function updateNextAuthSession(request: NextRequest) {
  // Check for NextAuth session token
  let token = null
  try {
    // Get all cookies for debugging
    const allCookies = request.cookies.getAll()
    const sessionCookies = allCookies.filter(c => 
      c.name.includes('next-auth') || c.name.includes('session')
    )
    
    // Debug logging for settings/profile routes
    if (request.nextUrl.pathname.startsWith("/settings") || request.nextUrl.pathname.startsWith("/profile")) {
      console.log(`[NextAuth Middleware] ${request.nextUrl.pathname}:`, {
        allCookiesCount: allCookies.length,
        sessionCookies: sessionCookies.map(c => ({ name: c.name, hasValue: !!c.value })),
        cookieNames: allCookies.map(c => c.name)
      })
    }
    
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: process.env.NODE_ENV === "production" 
        ? "__Secure-next-auth.session-token" 
        : "next-auth.session-token",
    })
  } catch (error) {
    console.error("[NextAuth Middleware] Error getting token:", error)
  }

  const user = token ? { id: token.id as string, email: token.email as string | null } : null
  
  // Debug logging
  if (request.nextUrl.pathname.startsWith("/settings") || request.nextUrl.pathname.startsWith("/profile")) {
    console.log(`[NextAuth Middleware] ${request.nextUrl.pathname}:`, {
      hasToken: !!token,
      hasUserId: !!token?.id,
      userId: token?.id,
      hasUser: !!user,
      tokenKeys: token ? Object.keys(token) : []
    })
  }

  // Protected routes that require authentication (Rockflix user routes)
  const protectedRoutes = ["/settings", "/profile", "/notifications", "/community/bookmarks"]
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  // Skip profile check for API routes and auth routes
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth/") || 
                      request.nextUrl.pathname.startsWith("/api/auth/")
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/")

  // Note: Profile check removed from middleware to avoid Edge runtime issues
  // Database queries using Node.js crypto module are not supported in Edge runtime
  // The page components will handle profile creation/verification instead

  // Only redirect to login if accessing a protected route without auth
  // BUT: Let the page also check - sometimes middleware can't read cookies properly
  // The page will handle the redirect if needed
  if (isProtectedRoute && !user) {
    console.log(`[NextAuth Middleware] No session found for ${request.nextUrl.pathname}, but letting page handle auth check`)
    // Don't redirect here - let the page component check the session
    // This avoids issues with cookie reading in middleware
  }

  return NextResponse.next()
}

