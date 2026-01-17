import { NextResponse } from "next/server"
import { Pool } from "pg"

import { adminRoute } from "@/lib/security/admin-middleware"

// Set maximum duration to 15 minutes for large database imports
export const maxDuration = 900 // 15 minutes (900 seconds)
export const dynamic = 'force-dynamic'

// Create PostgreSQL connection pool for Contabo
function getContaboPool() {
  const databaseUrl = process.env.CONTABO_DATABASE_URL || process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("CONTABO_DATABASE_URL or DATABASE_URL environment variable not set")
  }

  // Parse connection string to check if it's localhost
  let url
  try {
    url = new URL(databaseUrl.replace(/^postgresql:\/\//, "http://"))
  } catch (e) {
    throw new Error(`Invalid CONTABO_DATABASE_URL format: ${databaseUrl.substring(0, 30)}...`)
  }
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  
  // Log connection details (without password)
  console.log("[admin/import-to-contabo] Connecting to:", {
    hostname: url.hostname,
    port: url.port,
    database: url.pathname.replace("/", ""),
    username: url.username,
    isLocalhost,
  })

  // Remove any SSL mode from connection string to avoid conflicts
  let cleanUrl = databaseUrl.split("?")[0]
  // Disable SSL for all connections (both localhost and remote)
  cleanUrl += "?sslmode=disable"

  // Use connection string directly - this avoids password parsing issues
  return new Pool({
    connectionString: cleanUrl,
    max: 10, // Reduce pool size to avoid connection issues
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })
}

export const POST = adminRoute(async ({ request }) => {
  try {
    const databaseUrl = process.env.CONTABO_DATABASE_URL || process.env.DATABASE_URL
    console.log("[admin/import-to-contabo] Database URL:", databaseUrl ? `${databaseUrl.split("@")[0].split("//")[1].split(":")[0]}@***` : "NOT SET")
    
    if (!databaseUrl) {
      return NextResponse.json(
        { success: false, message: "CONTABO_DATABASE_URL environment variable not set" },
        { status: 500 }
      )
    }

    const pool = getContaboPool()

    console.log("[admin/import-to-contabo] Starting database import to Contabo PostgreSQL")

    const body = await request.json()
    const exportData = body.exportData
    const startTable = body.startTable || 0 // Start from this table index
    const batchSize = body.batchSize || 10 // Process this many tables per request

    if (!exportData || !exportData.tables) {
      throw new Error("Invalid export data format")
    }

    const stats: any = {}
    let totalImported = 0

    // Import tables in order (respecting foreign key dependencies)
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

    const client = await pool.connect()

    // Process tables in batches to avoid timeout (calculate outside try block)
    const endTable = Math.min(startTable + batchSize, importOrder.length)
    const tablesToProcess = importOrder.slice(startTable, endTable)
    
    console.log(`[admin/import-to-contabo] Processing tables ${startTable + 1}-${endTable} of ${importOrder.length}`)

    try {

      // Don't use transaction - commit after each table so data is saved even if timeout
      // This way partial imports still work

      for (const tableName of tablesToProcess) {
        try {
          const tableData = exportData.tables[tableName]

          if (!tableData || !tableData.data || tableData.data.length === 0) {
            console.log(`[admin/import-to-contabo] Skipping ${tableName} (no data)`)
            stats[tableName] = { imported: 0, skipped: true }
            continue
          }

          console.log(`[admin/import-to-contabo] Importing ${tableData.data.length} records into ${tableName}...`)

          let imported = 0
          let failed = 0

          // Import records in batches
          const recordBatchSize = 100
          for (let i = 0; i < tableData.data.length; i += recordBatchSize) {
            const batch = tableData.data.slice(i, i + recordBatchSize)

            for (const record of batch) {
              try {
                const columns = Object.keys(record)
                const values = Object.values(record)
                const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ")

                // Use ON CONFLICT DO NOTHING to avoid duplicate errors
                const query = `
                  INSERT INTO ${tableName} (${columns.join(", ")})
                  VALUES (${placeholders})
                  ON CONFLICT DO NOTHING
                `

                await client.query(query, values)
                imported++
              } catch (err) {
                failed++
                console.error(`[admin/import-to-contabo] Error importing record to ${tableName}:`, err)
              }
            }
          }

          stats[tableName] = { imported, failed }
          totalImported += imported
          console.log(`[admin/import-to-contabo] Imported ${imported} records into ${tableName} (${failed} failed)`)
          
          // Commit after each table to ensure data is saved even if timeout
          // This prevents losing progress if NGINX times out
        } catch (err) {
          console.error(`[admin/import-to-contabo] Failed to import ${tableName}:`, err)
          stats[tableName] = { error: err instanceof Error ? err.message : "Unknown error" }
        }
      }

      // Fix sequences only after all tables are done
      const allTablesProcessed = endTable >= importOrder.length
      if (allTablesProcessed) {
        console.log("[admin/import-to-contabo] Fixing sequences...")
        try {
          await client.query(`
            SELECT setval('movies_id_seq', COALESCE((SELECT MAX(id) FROM movies), 1), true);
            SELECT setval('genres_id_seq', COALESCE((SELECT MAX(id) FROM genres), 1), true);
            SELECT setval('actors_id_seq', COALESCE((SELECT MAX(id) FROM actors), 1), true);
            SELECT setval('seasons_id_seq', COALESCE((SELECT MAX(id) FROM seasons), 1), true);
            SELECT setval('episodes_id_seq', COALESCE((SELECT MAX(id) FROM episodes), 1), true);
            SELECT setval('comments_id_seq', COALESCE((SELECT MAX(id) FROM comments), 1), true);
            SELECT setval('posts_id_seq', COALESCE((SELECT MAX(id) FROM posts), 1), true);
            SELECT setval('profiles_id_seq', COALESCE((SELECT MAX(id) FROM profiles), 1), true);
          `)
        } catch (seqErr) {
          console.error("[admin/import-to-contabo] Error fixing sequences:", seqErr)
          // Don't fail the whole import if sequence fix fails
        }
      }

      console.log(`[admin/import-to-contabo] Batch complete! Imported ${totalImported} records from ${tablesToProcess.length} tables`)
    } catch (error) {
      throw error
    } finally {
      client.release()
    }

    const hasMore = endTable < importOrder.length
    return NextResponse.json({
      success: true,
      message: hasMore 
        ? `Batch ${Math.floor(startTable / batchSize) + 1} complete. ${endTable} of ${importOrder.length} tables processed. Click Import again to continue.`
        : "Database import completed",
      stats,
      totalImported,
      processed: endTable,
      total: importOrder.length,
      hasMore,
      nextStart: endTable,
    })
  } catch (error) {
    console.error("[admin/import-to-contabo] Import error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    console.error("[admin/import-to-contabo] Error details:", {
      message: errorMessage,
      databaseUrl: process.env.CONTABO_DATABASE_URL ? "SET" : "NOT SET",
      usingFallback: !process.env.CONTABO_DATABASE_URL && !!process.env.DATABASE_URL,
    })
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        hint: errorMessage.includes("doadmin") 
          ? "It looks like the system is trying to connect to DigitalOcean instead of Contabo. Please check CONTABO_DATABASE_URL is set correctly in .env.production"
          : undefined,
      },
      { status: 500 },
    )
  }
})

