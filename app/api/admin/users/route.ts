import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const GET = adminRoute(async ({ request, supabase }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const statusFilter = (searchParams.get("status") || "all") as "all" | "active" | "banned"

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { fetchUsersFromContabo } = await import('@/lib/database/contabo-queries')
      const result = await fetchUsersFromContabo(search || undefined, statusFilter, page, limit)
      
      return jsonResponse({
        data: result.users,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      })
    }

    // Fallback to Supabase
    // Build query
    let query = supabase
      .from("profiles")
      .select(
        "id, username, email, profile_picture_url, role, is_banned, banned_at, banned_reason, last_login, created_at",
        {
          count: "exact",
        },
      )

    // Apply search filter
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply status filter
    if (statusFilter === "active") {
      query = query.eq("is_banned", false)
    } else if (statusFilter === "banned") {
      query = query.eq("is_banned", true)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order("created_at", { ascending: false })

    const { data, error, count } = await query

    if (error) {
      console.error("[v0] Error fetching users:", error)
      return jsonResponse({ error: "Failed to fetch users" }, 500)
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
    console.error("[v0] Error in users GET:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
