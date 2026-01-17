import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { logModerationAction } from "@/lib/moderation"

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
    return parts[0] || null
  } catch {
    return null
  }
}

export const POST = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const userId = resolveUserId(routeContext, request)
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    const body = await request.json()
    const { duration_hours, reason, moderator_id } = body

    const mutedUntil = new Date()
    mutedUntil.setHours(mutedUntil.getHours() + duration_hours)

    const { error } = await supabase
      .from("profiles")
      .update({
        is_muted: true,
        muted_until: mutedUntil.toISOString(),
        muted_reason: reason,
      })
      .eq("id", userId)

    if (error) {
      console.error("[v0] Error muting user:", error)
      return NextResponse.json({ error: "Failed to mute user" }, { status: 500 })
    }

    await logModerationAction(moderator_id, "mute_user", "user", userId, reason, {
      duration_hours,
      muted_until: mutedUntil.toISOString(),
    })

    return NextResponse.json({ message: "User muted successfully", muted_until: mutedUntil })
  } catch (error) {
    console.error("[v0] Error in mute POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const DELETE = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const userId = resolveUserId(routeContext, request)
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    const { moderator_id } = await request.json()

    const { error } = await supabase
      .from("profiles")
      .update({
        is_muted: false,
        muted_until: null,
        muted_reason: null,
      })
      .eq("id", userId)

    if (error) {
      console.error("[v0] Error unmuting user:", error)
      return NextResponse.json({ error: "Failed to unmute user" }, { status: 500 })
    }

    await logModerationAction(moderator_id, "unmute_user", "user", userId, "Manual unmute")

    return NextResponse.json({ message: "User unmuted successfully" })
  } catch (error) {
    console.error("[v0] Error in unmute DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
