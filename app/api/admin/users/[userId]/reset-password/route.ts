import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

const ACTION_SEGMENTS = new Set(["reset-password"])

function resolveUserId(
  routeContext: { params?: Record<string, string | string[]> } | undefined,
  request: Request,
) {
  const raw = routeContext?.params?.userId
  if (Array.isArray(raw)) return raw[0]
  if (typeof raw === "string" && raw) return raw

  try {
    const url = new URL(request.url)
    const queryId = url.searchParams.get("userId")
    if (queryId) return queryId
    const parts = url.pathname.split("/").filter(Boolean).reverse()
    for (const segment of parts) {
      if (!ACTION_SEGMENTS.has(segment)) {
        return segment
      }
    }
    return null
  } catch {
    return null
  }
}

export const POST = adminRoute(async ({ request }, routeContext) => {
  try {
    const userId = resolveUserId(routeContext, request)
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    const { newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Update user password using admin API
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminClient = createAdminClient()

    const { error } = await adminClient.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      console.error("[v0] Error resetting password:", error)
      return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
    }

    return NextResponse.json({ message: "Password reset successfully" })
  } catch (error) {
    console.error("[v0] Error in password reset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
