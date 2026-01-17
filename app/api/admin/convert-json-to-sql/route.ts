import { NextResponse } from "next/server"
import { adminRoute } from "@/lib/security/admin-middleware"

function escapeSqlString(value: any): string {
  if (value === null || value === undefined) {
    return "NULL"
  }
  
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }
  
  if (typeof value === "number") {
    return String(value)
  }
  
  if (typeof value === "object") {
    // JSONB objects
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  
  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }
  
  // String - escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`
}

export const POST = adminRoute(async ({ request }) => {
  try {
    const body = await request.json()
    const exportData = body.exportData

    if (!exportData || !exportData.tables) {
      throw new Error("Invalid export data format")
    }

    let sql = "-- SQL Import Script for Contabo PostgreSQL\n"
    sql += "-- Generated from JSON export\n\n"

    const importOrder = [
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
      "admin_sessions",
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

    for (const tableName of importOrder) {
      const tableData = exportData.tables[tableName]
      
      if (!tableData || !tableData.data || tableData.data.length === 0) {
        sql += `-- Table ${tableName}: No data\n\n`
        continue
      }

      sql += `-- Table ${tableName}: ${tableData.data.length} records\n`
      sql += `BEGIN;\n\n`

      for (const record of tableData.data) {
        const columns = Object.keys(record)
        const values = columns.map(col => escapeSqlString(record[col]))
        
        sql += `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;\n`
      }

      sql += `\nCOMMIT;\n\n`
    }

    // Fix sequences
    sql += "-- Fix sequences\n"
    sql += `SELECT setval('movies_id_seq', COALESCE((SELECT MAX(id) FROM movies), 1), true);\n`
    sql += `SELECT setval('genres_id_seq', COALESCE((SELECT MAX(id) FROM genres), 1), true);\n`
    sql += `SELECT setval('actors_id_seq', COALESCE((SELECT MAX(id) FROM actors), 1), true);\n`

    return NextResponse.json({
      success: true,
      sql,
      size: sql.length,
    })
  } catch (error) {
    console.error("[admin/convert-json-to-sql] Error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
})

