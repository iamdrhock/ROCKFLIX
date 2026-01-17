#!/usr/bin/env node

/**
 * Direct import script to migrate data from Supabase export to Contabo PostgreSQL
 * 
 * This script runs directly on the VPS, bypassing NGINX timeout limits.
 * 
 * Usage:
 *   node scripts/direct-import-to-contabo.js /path/to/database-export.json
 * 
 * Or upload export file to VPS first:
 *   scp database-export.json runcloud@103.217.252.147:/home/runcloud/webapps/rockflix/current/
 *   ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && node scripts/direct-import-to-contabo.js database-export.json"
 */

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

// Read environment variables from .env.production
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.production')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim()
          }
        }
      }
    })
  }
}

loadEnv()

// Configuration
const DATABASE_URL = process.env.CONTABO_DATABASE_URL || process.env.DATABASE_URL
const BATCH_SIZE = 8 // Tables per batch
const RECORD_BATCH_SIZE = 500 // Records per batch for large tables

if (!DATABASE_URL) {
  console.error('ERROR: CONTABO_DATABASE_URL or DATABASE_URL environment variable not set')
  process.exit(1)
}

// Get export file path
const exportFile = process.argv[2] || 'database-export.json'
const exportPath = path.isAbsolute(exportFile) ? exportFile : path.join(process.cwd(), exportFile)

if (!fs.existsSync(exportPath)) {
  console.error(`ERROR: Export file not found: ${exportPath}`)
  process.exit(1)
}

console.log('???? Reading export file:', exportPath)
const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'))

if (!exportData || !exportData.tables) {
  console.error('ERROR: Invalid export data format')
  process.exit(1)
}

// Parse database URL
let dbUrl
try {
  let cleanUrl = DATABASE_URL.split('?')[0]
  cleanUrl += '?sslmode=disable'
  dbUrl = cleanUrl
} catch (e) {
  console.error('ERROR: Invalid DATABASE_URL format')
  process.exit(1)
}

console.log('???? Connecting to Contabo PostgreSQL...')
const pool = new Pool({
  connectionString: dbUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
})

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

async function importTable(client, tableName, tableData) {
  if (!tableData || !tableData.data || tableData.data.length === 0) {
    console.log(`   ??????  Skipping ${tableName} (no data)`)
    return { imported: 0, failed: 0, skipped: true }
  }

  console.log(`   ???? Importing ${tableData.data.length} records into ${tableName}...`)

  let imported = 0
  let failed = 0

  // Import records in batches
  for (let i = 0; i < tableData.data.length; i += RECORD_BATCH_SIZE) {
    const batch = tableData.data.slice(i, i + RECORD_BATCH_SIZE)

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
        if (failed <= 5) { // Only log first 5 errors to avoid spam
          console.error(`      ??? Error importing record to ${tableName}:`, err.message)
        }
      }
    }

    // Progress indicator for large tables
    if (tableData.data.length > 1000 && (i + RECORD_BATCH_SIZE) % 1000 === 0) {
      process.stdout.write(`      Progress: ${Math.min(i + RECORD_BATCH_SIZE, tableData.data.length)}/${tableData.data.length}\r`)
    }
  }

  if (tableData.data.length > 1000) {
    console.log() // New line after progress indicator
  }

  console.log(`   ??? Imported ${imported} records into ${tableName} (${failed} failed)`)
  return { imported, failed }
}

async function fixSequences(client) {
  console.log('???? Fixing sequences...')
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
    console.log('   ??? Sequences fixed')
  } catch (seqErr) {
    console.error('   ??????  Error fixing sequences:', seqErr.message)
  }
}

async function main() {
  const client = await pool.connect()

  try {
    // Test connection
    const testResult = await client.query('SELECT version()')
    console.log('??? Connected to PostgreSQL:', testResult.rows[0].version.split(',')[0])
    console.log()

    const stats = {}
    let totalImported = 0

    // Process tables in batches
    for (let startTable = 0; startTable < importOrder.length; startTable += BATCH_SIZE) {
      const endTable = Math.min(startTable + BATCH_SIZE, importOrder.length)
      const tablesToProcess = importOrder.slice(startTable, endTable)
      
      console.log(`???? Processing batch ${Math.floor(startTable / BATCH_SIZE) + 1}: tables ${startTable + 1}-${endTable} of ${importOrder.length}`)

      for (const tableName of tablesToProcess) {
        const tableData = exportData.tables[tableName]
        const result = await importTable(client, tableName, tableData)
        stats[tableName] = result
        totalImported += result.imported || 0
      }

      console.log(`   ??? Batch complete! Total imported so far: ${totalImported} records\n`)
    }

    // Fix sequences after all tables are imported
    await fixSequences(client)

    console.log()
    console.log('???? Import complete!')
    console.log(`   Total records imported: ${totalImported}`)
    console.log(`   Tables processed: ${importOrder.length}`)

    // Summary
    const failedTables = Object.entries(stats).filter(([_, s]) => s.failed > 0)
    if (failedTables.length > 0) {
      console.log()
      console.log('??????  Tables with failed imports:')
      failedTables.forEach(([table, stat]) => {
        console.log(`   ${table}: ${stat.failed} failed`)
      })
    }

  } catch (error) {
    console.error('??? Fatal error:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run import
main().catch((error) => {
  console.error('??? Unhandled error:', error)
  process.exit(1)
})

