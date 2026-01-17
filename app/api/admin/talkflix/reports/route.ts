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
    const status = searchParams.get("status")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { fetchTalkFlixReportsFromContabo } = await import('@/lib/database/contabo-queries')
      const reports = await fetchTalkFlixReportsFromContabo(status || undefined)
      return jsonResponse({ reports })
    }

    // Fallback to Supabase
    let query = supabase
      .from("user_reports")
      .select(`
        *,
        reporter:profiles!user_reports_reporter_id_fkey(username),
        reported_user:profiles!user_reports_reported_user_id_fkey(username),
        post_comments(comment_text)
      `)
      .order("created_at", { ascending: false })
      .limit(100)

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data: reports, error } = await query

    if (error) throw error

    const formattedReports = reports?.map((report: any) => ({
      ...report,
      reporter_username: report.reporter?.username,
      reported_username: report.reported_user?.username,
      comment_text: report.post_comments?.comment_text,
    }))

    return jsonResponse({ reports: formattedReports || [] })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return jsonResponse({ error: "Failed to fetch reports" }, 500)
  }
})
