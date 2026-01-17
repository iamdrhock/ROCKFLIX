import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { adminRoute } from "@/lib/security/admin-middleware"
import { generateCsrfToken, setCsrfTokenCookie, getCsrfTokenFromCookie } from "@/lib/security/csrf"

// Helper to safely use NextResponse or fallback to native Response
function safeJsonResponse(data: any, status: number = 200) {
  try {
    if (typeof NextResponse !== 'undefined' && NextResponse && NextResponse.json) {
      return NextResponse.json(data, { status })
    }
  } catch (e) {
    // Fall through
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

// GET endpoint to retrieve CSRF token (doesn't require CSRF check since it's a GET)
export const GET = adminRoute(async ({ request }) => {
  // Return existing token if available, otherwise generate new one
  const existingToken = getCsrfTokenFromCookie(request)
  const token = existingToken || generateCsrfToken()

  // Try to use NextResponse for cookie handling
  let response: Response
  try {
    if (typeof NextResponse !== 'undefined' && NextResponse && NextResponse.json) {
      response = NextResponse.json({ csrfToken: token })
      if (!existingToken) {
        setCsrfTokenCookie(response, token)
      }
      return response
    }
  } catch (e) {
    // Fall through to native Response
  }

  // Fallback to native Response
  response = safeJsonResponse({ csrfToken: token })
  if (!existingToken) {
    setCsrfTokenCookie(response, token)
  }
  return response
})

