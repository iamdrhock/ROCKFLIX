import { NextResponse } from "next/server"
import { Pool } from "pg"
import { adminRoute } from "@/lib/security/admin-middleware"

// Check if we're using DigitalOcean or Supabase
function getDatabaseUrl() {
  // Check if DATABASE_URL points to DigitalOcean
  const databaseUrl = process.env.DATABASE_URL || ""

  if (databaseUrl.includes("doadmin") || databaseUrl.includes("ondigitalocean.com")) {
    return databaseUrl
  }

  // Otherwise use DigitalOcean URL from your scripts
  return "postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
}

export const GET = adminRoute(async ({ request }) => {
  try {
    const databaseUrl = getDatabaseUrl()

    console.log("[admin/verify-digitalocean] Connecting to:", databaseUrl.split("@")[1]?.split("/")[0] || "masked")

    // Parse connection string
    const url = new URL(databaseUrl.replace(/^postgresql:\/\//, "http://"))
    const isDigitalOcean = url.hostname.includes("ondigitalocean.com")

    if (!isDigitalOcean) {
      return NextResponse.json({
        error: "DATABASE_URL does not point to DigitalOcean",
        currentDatabase: url.hostname,
        message: "Your app appears to be connected to a different database. Please check your DATABASE_URL environment variable."
      }, { status: 400 })
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })

    const client = await pool.connect()

    try {
      // Get all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `)

      const tables = tablesResult.rows.map(row => row.table_name)

      // Get record counts
      const counts: Record<string, number> = {}
      for (const table of tables) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`)
          counts[table] = parseInt(countResult.rows[0].count)
        } catch (error) {
          counts[table] = 0
        }
      }

      const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0)

      // Get sample data from key tables
      const samples: Record<string, any[]> = {}
      const keyTables = ["movies", "site_settings", "admin_users", "genres", "actors", "players"]

      for (const table of keyTables) {
        if (tables.includes(table)) {
          try {
            if (table === "movies") {
              // Get both movies and series
              const movieResult = await client.query(`
                SELECT id, title, type, views, created_at 
                FROM movies 
                WHERE type = 'movie' 
                LIMIT 3
              `)
              const seriesResult = await client.query(`
                SELECT id, title, type, views, created_at 
                FROM movies 
                WHERE type = 'series' 
                LIMIT 3
              `)
              samples[table] = {
                movies: movieResult.rows,
                series: seriesResult.rows,
              }
            } else {
              const result = await client.query(`SELECT * FROM ${table} LIMIT 5`)
              samples[table] = result.rows
            }
          } catch (error) {
            samples[table] = []
          }
        }
      }

      // Get site_settings columns
      let siteSettingsColumns: any[] = []
      if (tables.includes("site_settings")) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'site_settings'
          ORDER BY ordinal_position;
        `)
        siteSettingsColumns = columnsResult.rows
      }

      // Get players table structure
      let playersColumns: any[] = []
      if (tables.includes("players")) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'players'
          ORDER BY ordinal_position;
        `)
        playersColumns = columnsResult.rows
      }

      return NextResponse.json({
        success: true,
        verified: true,
        database: {
          host: url.hostname,
          port: url.port,
          database: url.pathname.replace("/", ""),
          user: url.username,
          type: "DigitalOcean PostgreSQL"
        },
        summary: {
          totalTables: tables.length,
          totalRecords,
          tablesWithData: Object.entries(counts).filter(([_, count]) => count > 0).length
        },
        tables: tables.map(table => ({
          name: table,
          recordCount: counts[table]
        })),
        recordCounts: counts,
        samples,
        siteSettingsColumns,
        playersColumns,
        message: `✅ Verified! Your DigitalOcean database has ${tables.length} tables with ${totalRecords.toLocaleString()} total records.`
      })

    } finally {
      client.release()
      await pool.end()
    }

  } catch (error) {
    console.error("[admin/verify-digitalocean] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to connect to DigitalOcean database. Please check your DATABASE_URL or connection details."
    }, { status: 500 })
  }
})

