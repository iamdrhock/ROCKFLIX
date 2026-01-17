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
      return jsonResponse({ error: "Missing report id" }, 400)
    }

    const body = await request.json()
    const { status, resolution_notes } = body

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { updateTalkFlixReportInContabo } = await import('@/lib/database/contabo-writes')
      await updateTalkFlixReportInContabo(id, status, resolution_notes)
      return jsonResponse({ success: true })
    }

    // Fallback to Supabase
    const { error } = await supabase
      .from("user_reports")
      .update({
        status,
        resolution_notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (error) {
    console.error("Error resolving report:", error)
    return jsonResponse({ error: "Failed to resolve report" }, 500)
  }
})
