import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

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

// Update user (ban/unban, change role)
export const PATCH = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const userId = resolveUserId(routeContext, request)
    if (!userId) {
      return jsonResponse({ error: "Missing user id" }, 400)
    }

    const body = await request.json()
    const { is_banned, banned_reason, role } = body

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { updateUserInContabo } = await import('@/lib/database/contabo-writes')
      
      const updates: any = {}
      if (typeof is_banned === "boolean") {
        updates.is_banned = is_banned
        updates.banned_at = is_banned ? new Date().toISOString() : null
        updates.banned_reason = is_banned ? (banned_reason || "No reason provided") : null
      }
      if (role) {
        updates.role = role
      }

      await updateUserInContabo(userId, updates)
      return jsonResponse({ message: "User updated successfully" })
    }

    // Fallback to Supabase
    const updateData: Record<string, unknown> = {}

    if (typeof is_banned === "boolean") {
      updateData.is_banned = is_banned
      updateData.banned_at = is_banned ? new Date().toISOString() : null
      updateData.banned_reason = is_banned ? banned_reason || "No reason provided" : null
    }

    if (role) {
      updateData.role = role
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId)

    if (error) {
      console.error("[v0] Error updating user:", error)
      return jsonResponse({ error: "Failed to update user" }, 500)
    }

    return jsonResponse({ message: "User updated successfully" })
  } catch (error) {
    console.error("[v0] Error in user PATCH:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})

// Delete user
export const DELETE = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const userId = resolveUserId(routeContext, request)
    if (!userId) {
      return jsonResponse({ error: "Missing user id" }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { deleteUserFromContabo } = await import('@/lib/database/contabo-writes')
      
      // Delete from Contabo profiles and related data
      await deleteUserFromContabo(userId)
      
      // Still need to delete from Supabase auth (if using Supabase auth)
      // This is a limitation - auth is still managed by Supabase
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)
        if (authError) {
          console.warn("[v0] Warning: Could not delete user from auth (may not exist):", authError)
          // Continue anyway since profile is deleted
        }
      } catch (authErr) {
        console.warn("[v0] Warning: Error deleting from auth:", authErr)
        // Continue anyway
      }
      
      return jsonResponse({ message: "User deleted successfully" })
    }

    // Fallback to Supabase
    // Delete from auth.users (this will cascade to profiles due to foreign key)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
      console.error("[v0] Error deleting user from auth:", authError)
      return jsonResponse({ error: "Failed to delete user" }, 500)
    }

    return jsonResponse({ message: "User deleted successfully" })
  } catch (error) {
    console.error("[v0] Error in user DELETE:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
