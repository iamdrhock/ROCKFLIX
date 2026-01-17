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
    const search = searchParams.get("search")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      let sql = `
        SELECT 
          id, username, email, profile_picture_url, is_banned, is_muted, 
          muted_until, banned_reason, muted_reason, created_at, reputation_score, role
        FROM profiles
        WHERE 1=1
      `
      const params: any[] = []
      let paramIndex = 1

      if (search) {
        sql += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`
        params.push(`%${search}%`)
        paramIndex++
      }

      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
      params.push(100)

      const result = await queryContabo<any>(sql, params)
      return jsonResponse({ users: result.rows || [] })
    }

    // Fallback to Supabase
    let query = supabase
      .from("profiles")
      .select("id, username, email, profile_picture_url, is_banned, is_muted, muted_until, banned_reason, muted_reason, created_at, reputation_score, role")
      .order("created_at", { ascending: false })
      .limit(100)

    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: users, error } = await query

    if (error) throw error

    return jsonResponse({ users: users || [] })
  } catch (error) {
    console.error("Error fetching users:", error)
    return jsonResponse({ error: "Failed to fetch users" }, 500)
  }
})
