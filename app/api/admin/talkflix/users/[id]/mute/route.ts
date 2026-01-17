import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

const ACTION_SEGMENTS = new Set(["ban", "mute", "resolve"])

function resolveId(
  routeContext: { params?: Record<string, string | string[]> } | undefined,
  request: Request,
) {
  const raw = routeContext?.params?.id
  if (Array.isArray(raw)) {
    return raw[0]
  }
  if (typeof raw === "string" && raw) {
    return raw
  }

  try {
    const url = new URL(request.url)
    const fromQuery = url.searchParams.get("id")
    if (fromQuery) return fromQuery
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

export const POST = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const id = resolveId(routeContext, request)
    if (!id) {
      return jsonResponse({ error: "Missing user id" }, 400)
    }

    const body = await request.json()
    const { is_muted, muted_reason, hours } = body

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { updateUserInContabo } = await import('@/lib/database/contabo-writes')
      
      let mutedUntil: string | null = null
      if (is_muted) {
        const durationHours = Number.isFinite(Number(hours)) && Number(hours) > 0 ? Number(hours) : 24
        const mutedUntilDate = new Date()
        mutedUntilDate.setHours(mutedUntilDate.getHours() + durationHours)
        mutedUntil = mutedUntilDate.toISOString()
      }
      
      await updateUserInContabo(id, {
        is_muted,
        muted_reason,
        muted_until: mutedUntil,
      })
      
      return jsonResponse({ success: true })
    }

    // Fallback to Supabase
    const updateData: any = {
      is_muted,
      muted_reason,
    }

    if (is_muted) {
      const durationHours = Number.isFinite(Number(hours)) && Number(hours) > 0 ? Number(hours) : 24
      const mutedUntil = new Date()
      mutedUntil.setHours(mutedUntil.getHours() + durationHours)
      updateData.muted_until = mutedUntil.toISOString()
    } else {
      updateData.muted_until = null
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", id)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (error) {
    console.error("Error muting/unmuting user:", error)
    return jsonResponse({ error: "Failed to update user status" }, 500)
  }
})
