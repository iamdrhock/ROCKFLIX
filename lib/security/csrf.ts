import { randomBytes } from "crypto"
import type { NextRequest } from "next/server"

const CSRF_TOKEN_COOKIE = "csrf_token"
const CSRF_TOKEN_HEADER = "X-CSRF-Token"
const CSRF_TOKEN_MAX_AGE = 60 * 60 * 24 // 24 hours

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex")
}

/**
 * Set CSRF token in response cookie
 */
export function setCsrfTokenCookie(response: Response, token: string): void {
  try {
    // Try to use NextResponse cookies API if available
    if ((response as any).cookies && typeof (response as any).cookies.set === 'function') {
      (response as any).cookies.set({
        name: CSRF_TOKEN_COOKIE,
        value: token,
        httpOnly: false, // Must be readable by JavaScript for form submission
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: CSRF_TOKEN_MAX_AGE,
      })
      return
    }
  } catch (e) {
    // Fall through to manual header
  }
  
  // Fallback: Set cookie manually via Set-Cookie header
  const secure = process.env.NODE_ENV === "production" ? "Secure" : ""
  const cookieValue = `${CSRF_TOKEN_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=${CSRF_TOKEN_MAX_AGE}${secure ? `; ${secure}` : ""}`
  response.headers.append("Set-Cookie", cookieValue)
}

/**
 * Get CSRF token from request cookie
 */
export function getCsrfTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_TOKEN_COOKIE)?.value || null
}

/**
 * Get CSRF token from request header
 */
export function getCsrfTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_TOKEN_HEADER) || null
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = getCsrfTokenFromCookie(request)
  const headerToken = getCsrfTokenFromHeader(request)

  if (!cookieToken || !headerToken) {
    return false
  }

  // Compare tokens using constant-time comparison to prevent timing attacks
  return constantTimeCompare(cookieToken, headerToken)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Middleware to require CSRF token for state-changing requests
 */
export function requireCsrfToken(request: NextRequest): { valid: boolean; response?: Response } {
  // Only check CSRF for state-changing methods
  const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"]
  
  if (!stateChangingMethods.includes(request.method)) {
    return { valid: true }
  }

  // Allow bypass for internal server-to-server calls
  // This is used for bulk import operations that make internal HTTP calls
  const isInternalCall = request.headers.get("x-internal-bulk-import") === "true"
  if (isInternalCall) {
    // Still validate that we have a CSRF token, but be more lenient
    const cookieToken = getCsrfTokenFromCookie(request)
    const headerToken = getCsrfTokenFromHeader(request)
    
    // For internal calls, we accept if either token exists (they should match, but we're lenient for internal calls)
    if (cookieToken || headerToken) {
      return { valid: true }
    }
  }

  if (!validateCsrfToken(request)) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({ error: "Invalid or missing CSRF token" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    }
  }

  return { valid: true }
}

