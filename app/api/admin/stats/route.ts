import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { queryContabo } from "@/lib/database/contabo-pool"

export const GET = adminRoute(async ({ supabase, request }) => {
  try {
    console.log("[admin/stats] Stats API called, method:", request.method)
    console.log("[admin/stats] Request URL:", request.url)
    
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    console.log("[admin/stats] Using Contabo:", useContabo)

    if (useContabo) {
      // Get stats from Contabo
      console.log("[admin/stats] Fetching stats from Contabo...")
      
      try {
        const [moviesResult, seriesResult, seasonsResult, episodesResult, commentsResult, viewsResult] = await Promise.all([
          queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM movies WHERE type = $1', ['movie']),
          queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM movies WHERE type = $1', ['series']),
          queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM seasons', []),
          queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM episodes', []),
          queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM comments WHERE moderation_status = $1', ['approved']),
          queryContabo<{ sum: string }>('SELECT COALESCE(SUM(views), 0) as sum FROM movies', []),
        ])

        const totalMovies = parseInt(moviesResult.rows[0]?.count || '0', 10)
        const totalSeries = parseInt(seriesResult.rows[0]?.count || '0', 10)
        const totalSeasons = parseInt(seasonsResult.rows[0]?.count || '0', 10)
        const totalEpisodes = parseInt(episodesResult.rows[0]?.count || '0', 10)
        const totalComments = parseInt(commentsResult.rows[0]?.count || '0', 10)
        const totalViews = parseInt(viewsResult.rows[0]?.sum || '0', 10)

        const statsData = {
          total_movies: totalMovies,
          total_series: totalSeries,
          total_seasons: totalSeasons,
          total_episodes: totalEpisodes,
          total_comments: totalComments,
          total_views: totalViews,
        }

        console.log("[admin/stats] Returning stats from Contabo:")
        console.log("[admin/stats]   Movies:", totalMovies)
        console.log("[admin/stats]   Series:", totalSeries)
        console.log("[admin/stats]   Seasons:", totalSeasons)
        console.log("[admin/stats]   Episodes:", totalEpisodes)
        console.log("[admin/stats]   Comments:", totalComments)
        console.log("[admin/stats]   Views:", totalViews)
        console.log("[admin/stats] Raw query results:", JSON.stringify({
          movies: moviesResult.rows[0],
          series: seriesResult.rows[0],
          seasons: seasonsResult.rows[0],
          episodes: episodesResult.rows[0],
          comments: commentsResult.rows[0],
          views: viewsResult.rows[0],
        }))
        
        return NextResponse.json(statsData, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
      } catch (contaboError: any) {
        console.error("[admin/stats] Error fetching stats from Contabo:", contaboError)
        console.error("[admin/stats] Error details:", {
          message: contaboError?.message,
          code: contaboError?.code,
          stack: contaboError?.stack
        })
        // Return error response instead of falling through
        return NextResponse.json(
          {
            total_movies: 0,
            total_series: 0,
            total_seasons: 0,
            total_episodes: 0,
            total_comments: 0,
            total_views: 0,
            error: contaboError?.message || "Failed to fetch stats from Contabo"
          },
          { status: 500 }
        )
      }
    }
    
    // Use service role client to bypass RLS and ensure we get accurate counts
    const serviceSupabase = createServiceRoleClient()
    console.log("[admin/stats] Using service role client for stats queries")

    // Get total movies count
    console.log("[admin/stats] Fetching movies count...")
    const { count: moviesCount, error: moviesError } = await serviceSupabase
      .from("movies")
      .select("*", { count: "exact", head: true })
      .eq("type", "movie")

    if (moviesError) {
      console.error("[admin/stats] Error fetching movies count:", moviesError)
    } else {
      console.log("[admin/stats] Movies count:", moviesCount)
    }

    // Get total series count
    console.log("[admin/stats] Fetching series count...")
    const { count: seriesCount, error: seriesError } = await serviceSupabase
      .from("movies")
      .select("*", { count: "exact", head: true })
      .eq("type", "series")

    if (seriesError) {
      console.error("[admin/stats] Error fetching series count:", seriesError)
    } else {
      console.log("[admin/stats] Series count:", seriesCount)
    }

    // Get total seasons count
    console.log("[admin/stats] Fetching seasons count...")
    const { count: seasonsCount, error: seasonsError } = await serviceSupabase
      .from("seasons")
      .select("*", { count: "exact", head: true })

    if (seasonsError) {
      console.error("[admin/stats] Error fetching seasons count:", seasonsError)
    } else {
      console.log("[admin/stats] Seasons count:", seasonsCount)
    }

    // Get total episodes count
    console.log("[admin/stats] Fetching episodes count...")
    const { count: episodesCount, error: episodesError } = await serviceSupabase
      .from("episodes")
      .select("*", { count: "exact", head: true })

    if (episodesError) {
      console.error("[admin/stats] Error fetching episodes count:", episodesError)
    } else {
      console.log("[admin/stats] Episodes count:", episodesCount)
    }

    // Get total comments count
    console.log("[admin/stats] Fetching comments count...")
    const { count: commentsCount, error: commentsError } = await serviceSupabase
      .from("comments")
      .select("*", { count: "exact", head: true })

    if (commentsError) {
      console.error("[admin/stats] Error fetching comments count:", commentsError)
    } else {
      console.log("[admin/stats] Comments count:", commentsCount)
    }

    // Get total views (sum of all movie views)
    // Use a more efficient approach - get count first, then fetch in batches if needed
    console.log("[admin/stats] Fetching views data...")
    let totalViews = 0
    try {
      const { data: viewsData, error: viewsError } = await serviceSupabase
        .from("movies")
        .select("views")
        .limit(10000) // Safety limit: max 10k movies to process

      if (viewsError) {
        console.error("[admin/stats] Error fetching views:", viewsError)
        // If query fails, return 0 for views but continue with other stats
        totalViews = 0
      } else {
        totalViews = viewsData?.reduce((sum, movie) => sum + (movie.views || 0), 0) || 0
        console.log("[admin/stats] Total views calculated:", totalViews, "from", viewsData?.length || 0, "movies")
      }
    } catch (viewsException) {
      console.error("[admin/stats] Exception fetching views:", viewsException)
      totalViews = 0
    }

    const statsData = {
      total_movies: moviesCount || 0,
      total_series: seriesCount || 0,
      total_seasons: seasonsCount || 0,
      total_episodes: episodesCount || 0,
      total_comments: commentsCount || 0,
      total_views: totalViews,
    }

    console.log("[admin/stats] Returning stats:", statsData)
    return NextResponse.json(statsData)
  } catch (error) {
    console.error("[admin/stats] Error fetching admin stats:", error)
    console.error("[admin/stats] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        total_movies: 0,
        total_series: 0,
        total_seasons: 0,
        total_episodes: 0,
        total_comments: 0,
        total_views: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
})
