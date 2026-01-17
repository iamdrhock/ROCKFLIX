import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200, additionalHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json",
      ...additionalHeaders
    }
  })
}

export const GET = adminRoute(async ({ supabase }) => {
  try {
    console.log("[admin] GET /api/admin/analytics/overview")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[admin/analytics] Using Contabo for analytics")
      const { fetchAnalyticsOverviewFromContabo } = await import('@/lib/database/contabo-queries')
      const analytics = await fetchAnalyticsOverviewFromContabo()
      console.log("[admin/analytics] Analytics data from Contabo:", {
        totalViews: analytics.overview?.totalViews,
        uniqueVisitors: analytics.overview?.uniqueVisitors,
        totalSearches: analytics.overview?.totalSearches,
        totalErrors: analytics.overview?.totalErrors,
      })
      return jsonResponse(analytics, 200, {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      })
    }

    // Fallback to Supabase
    // Get date ranges
    const today = new Date()
    const last7Days = new Date(today)
    last7Days.setDate(today.getDate() - 7)
    const last30Days = new Date(today)
    last30Days.setDate(today.getDate() - 30)

    // Total views (last 30 days)
    const { count: totalViews } = await supabase
      .from("view_analytics")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last30Days.toISOString())

    // Unique visitors (last 30 days)
    // Limit to prevent resource exhaustion from large datasets
    const { data: uniqueVisitors } = await supabase
      .from("view_analytics")
      .select("session_id")
      .gte("created_at", last30Days.toISOString())
      .limit(50000) // Safety limit: max 50k records

    const uniqueSessionsCount = new Set(uniqueVisitors?.map((v) => v.session_id)).size

    // Total searches (last 30 days)
    const { count: totalSearches } = await supabase
      .from("search_analytics")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last30Days.toISOString())

    // Total player errors (last 30 days)
    const { count: totalErrors } = await supabase
      .from("player_errors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last30Days.toISOString())

    // Most watched content (last 30 days)
    // Limit to prevent resource exhaustion from large datasets
    const { data: mostWatchedData } = await supabase
      .from("view_analytics")
      .select("movie_id, movies(id, title, poster_url, type)")
      .gte("created_at", last30Days.toISOString())
      .limit(50000) // Safety limit: max 50k records

    const movieViewCounts = mostWatchedData?.reduce(
      (acc, view: any) => {
        const movieId = view.movie_id
        if (!acc[movieId]) {
          acc[movieId] = {
            movie: view.movies,
            count: 0,
          }
        }
        acc[movieId].count++
        return acc
      },
      {} as Record<number, { movie: any; count: number }>,
    )

    const mostWatched = Object.values(movieViewCounts || {})
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Popular search terms (last 30 days)
    // Limit to prevent resource exhaustion from large datasets
    const { data: searchData } = await supabase
      .from("search_analytics")
      .select("query")
      .gte("created_at", last30Days.toISOString())
      .limit(20000) // Safety limit: max 20k search records

    const searchTermCounts = searchData?.reduce(
      (acc, search) => {
        const query = search.query.toLowerCase().trim()
        acc[query] = (acc[query] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const popularSearches = Object.entries(searchTermCounts || {})
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Device breakdown
    // Limit to prevent resource exhaustion from large datasets
    const { data: deviceData } = await supabase
      .from("view_analytics")
      .select("device_type")
      .gte("created_at", last30Days.toISOString())
      .limit(50000) // Safety limit: max 50k records

    const deviceBreakdown = deviceData?.reduce(
      (acc, view) => {
        const device = view.device_type || "unknown"
        acc[device] = (acc[device] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Player errors by type
    const { data: errorData } = await supabase
      .from("player_errors")
      .select("error_type, player_used, movie_id, movies(title)")
      .gte("created_at", last30Days.toISOString())
      .order("created_at", { ascending: false })
      .limit(20)

    // Daily trend data (last 7 days)
    // Limit to prevent resource exhaustion from large datasets
    const { data: dailyTrend } = await supabase
      .from("view_analytics")
      .select("created_at")
      .gte("created_at", last7Days.toISOString())
      .limit(100000) // Safety limit: max 100k records for 7 days

    const dailyViewCounts = dailyTrend?.reduce(
      (acc, view) => {
        const date = new Date(view.created_at).toISOString().split("T")[0]
        acc[date] = (acc[date] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const trendData = Object.entries(dailyViewCounts || {})
      .map(([date, count]) => ({ date, views: count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return jsonResponse({
      overview: {
        totalViews: totalViews || 0,
        uniqueVisitors: uniqueSessionsCount || 0,
        totalSearches: totalSearches || 0,
        totalErrors: totalErrors || 0,
      },
      mostWatched,
      popularSearches,
      deviceBreakdown,
      recentErrors: errorData || [],
      trendData,
    })
  } catch (error) {
    console.error("[admin] Error fetching analytics:", error)
    return jsonResponse({ error: "Failed to fetch analytics" }, 500)
  }
})
