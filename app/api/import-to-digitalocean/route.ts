import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

import { adminRoute } from "@/lib/security/admin-middleware"

export const POST = adminRoute(async ({ request }) => {
  try {
    // Use DigitalOcean PostgreSQL connection string
    const databaseUrl = process.env.DIGITALOCEAN_DATABASE_URL || process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DIGITALOCEAN_DATABASE_URL or DATABASE_URL environment variable not set")
    }

    const sql = neon(databaseUrl)

    console.log("[v0] Starting database import to DigitalOcean PostgreSQL")

    const body = await request.json()
    const exportData = body.exportData

    if (!exportData || !exportData.tables) {
      throw new Error("Invalid export data format")
    }

    const stats: any = {}
    let totalImported = 0

    // Import tables in order (respecting foreign key dependencies)
    const importOrder = Object.keys(exportData.tables)

    for (const tableName of importOrder) {
      try {
        const tableData = exportData.tables[tableName]

        if (!tableData.data || tableData.data.length === 0) {
          console.log(`[v0] Skipping ${tableName} (no data)`)
          stats[tableName] = { imported: 0, skipped: true }
          continue
        }

        console.log(`[v0] Importing ${tableData.data.length} records into ${tableName}...`)

        let imported = 0
        let failed = 0

        // Import records in batches
        const batchSize = 100
        for (let i = 0; i < tableData.data.length; i += batchSize) {
          const batch = tableData.data.slice(i, i + batchSize)

          for (const record of batch) {
            try {
              const columns = Object.keys(record)
              const values = Object.values(record)
              const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ")

              const query = `
                INSERT INTO ${tableName} (${columns.join(", ")})
                VALUES (${placeholders})
                ON CONFLICT DO NOTHING
              `

              await sql(query, values)
              imported++
            } catch (err) {
              failed++
              console.error(`[v0] Error importing record to ${tableName}:`, err)
            }
          }
        }

        stats[tableName] = { imported, failed }
        totalImported += imported
        console.log(`[v0] Imported ${imported} records into ${tableName} (${failed} failed)`)
      } catch (err) {
        console.error(`[v0] Failed to import ${tableName}:`, err)
        stats[tableName] = { error: err instanceof Error ? err.message : "Unknown error" }
      }
    }

    console.log(`[v0] Import complete! ${totalImported} total records imported`)

    return NextResponse.json({
      success: true,
      message: "Database import completed",
      stats,
      totalImported,
    })
  } catch (error) {
    console.error("[v0] Import error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
})
