import { NextResponse } from "next/server"

import { adminRoute, clearAdminSessionCookie, destroyAdminSession } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const POST = adminRoute(async ({ supabase, sessionId }) => {
  await destroyAdminSession(supabase, sessionId)

  // Try to use NextResponse for cookie handling, fallback to native Response
  try {
    if (typeof NextResponse !== 'undefined' && NextResponse && NextResponse.json) {
      const response = NextResponse.json({ success: true })
      clearAdminSessionCookie(response)
      return response
    }
  } catch (e) {
    // Fall through to native Response
  }

  // Fallback to native Response (cookies won't be cleared, but logout will work)
  return jsonResponse({ success: true })
})

