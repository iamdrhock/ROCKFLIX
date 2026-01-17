import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

// Get flagged/pending comments
export const GET = adminRoute(async ({ request, supabase }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = (searchParams.get("status") || "all") as "all" | "flagged" | "pending" | "spam"
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { fetchCommentsForModerationFromContabo } = await import('@/lib/database/contabo-queries')
      const result = await fetchCommentsForModerationFromContabo(status, page, limit)
      
      return jsonResponse({
        data: result.comments,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      })
    }

    // Fallback to Supabase
    let query = supabase.from("comments").select(
      `
        *,
        profiles:user_id (
          username,
          email,
          profile_picture_url,
          reputation_score
        )
      `,
      { count: "exact" },
    )

    // Apply filters
    if (status === "flagged") {
      query = query.eq("is_flagged", true)
    } else if (status === "pending") {
      query = query.eq("moderation_status", "pending")
    } else if (status === "spam") {
      query = query.eq("is_spam", true)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order("created_at", { ascending: false })

    const { data, error, count } = await query

    if (error) {
      console.error("[v0] Error fetching comments for moderation:", error)
      return jsonResponse({ error: "Failed to fetch comments" }, 500)
    }

    return jsonResponse({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error("[v0] Error in moderation comments GET:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
