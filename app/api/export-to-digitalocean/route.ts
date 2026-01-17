import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

import { adminRoute } from "@/lib/security/admin-middleware"

export const POST = adminRoute(async () => {
  try {
    const supabase = createServiceRoleClient()

    console.log("[v0] Starting database export from Supabase")

    const exportData: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0",
      },
      tables: {},
    }

    // Define tables to export in order (respecting foreign key dependencies)
    const tables = [
      "genres",
      "countries",
      "tags",
      "actors",
      "movies",
      "seasons",
      "episodes",
      "movie_genres",
      "movie_countries",
      "movie_actors",
      "movie_tags",
      "admin_users",
      "profiles",
      "comments",
      "comment_likes",
      "favorites",
      "watchlist",
      "series_followers",
      "reactions",
      "download_links",
      "blog_posts",
      "custom_pages",
      "advertisements",
      "site_settings",
      "players",
      "posts",
      "post_likes",
      "post_comments",
      "post_reposts",
      "post_hashtags",
      "post_movies",
      "hashtags",
      "bookmarks",
      "user_follows",
      "conversations",
      "conversation_participants",
      "messages",
      "notification_preferences",
      "email_notifications_log",
      "talkflix_notifications",
      "user_reports",
      "moderation_logs",
      "spam_patterns",
      "view_analytics",
      "search_analytics",
      "player_errors",
      "daily_stats",
      "rate_limits",
    ]

    let totalRecords = 0

    for (const tableName of tables) {
      try {
        console.log(`[v0] Exporting ${tableName}...`)

        // Fetch all data from table in batches
        let allData: any[] = []
        let from = 0
        const batchSize = 1000

        while (true) {
          const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .range(from, from + batchSize - 1)

          if (error) {
            console.error(`[v0] Error fetching ${tableName}:`, error.message)
            break
          }

          if (!data || data.length === 0) break

          allData = allData.concat(data)
          from += batchSize

          if (data.length < batchSize) break
        }

        exportData.tables[tableName] = {
          count: allData.length,
          data: allData,
        }

        totalRecords += allData.length
        console.log(`[v0] Exported ${allData.length} records from ${tableName}`)
      } catch (err) {
        console.error(`[v0] Failed to export ${tableName}:`, err)
        exportData.tables[tableName] = {
          count: 0,
          data: [],
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }

    exportData.metadata.totalRecords = totalRecords
    exportData.metadata.totalTables = Object.keys(exportData.tables).length

    console.log(
      `[v0] Export complete! ${totalRecords} total records from ${Object.keys(exportData.tables).length} tables`,
    )

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="supabase-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("[v0] Export error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
})
