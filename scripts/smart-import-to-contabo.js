#!/usr/bin/env node

/**
 * Smart Import - Queries actual table structure and only inserts columns that exist
 * This avoids ALL schema mismatch errors
 */

const fs = require('fs')
const { Pool } = require('pg')

// Get connection string from env or use default
const databaseUrl = process.env.CONTABO_DATABASE_URL || process.argv[2] || 'postgresql://postgres:x70wIAAISfu4pqmo@localhost:5432/postgres'
const jsonFile = process.argv[3] || 'database-export.json'

if (!fs.existsSync(jsonFile)) {
  console.error(`Error: File not found: ${jsonFile}`)
  process.exit(1)
}

console.log('Reading export data...')
const exportData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))

if (!exportData.tables) {
  console.error('Error: Invalid export data format')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: false, // localhost
})

async function getTableColumns(tableName) {
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
    `, [tableName])
    return new Set(result.rows.map(row => row.column_name))
  } catch (error) {
    console.error(`Warning: Could not get columns for ${tableName}:`, error.message)
    return new Set()
  }
}

function escapeSqlString(value) {
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
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

const importOrder = [
  "genres", "countries", "tags", "actors", "movies", "seasons", "episodes",
  "movie_genres", "movie_countries", "movie_actors", "movie_tags",
  "admin_users", "admin_sessions", "profiles", "comments", "comment_likes",
  "favorites", "watchlist", "series_followers", "reactions", "download_links",
  "blog_posts", "custom_pages", "advertisements", "site_settings", "players",
  "posts", "post_likes", "post_comments", "post_reposts", "post_hashtags",
  "post_movies", "hashtags", "bookmarks", "user_follows", "conversations",
  "conversation_participants", "messages", "notification_preferences",
  "email_notifications_log", "talkflix_notifications", "user_reports",
  "moderation_logs", "spam_patterns", "view_analytics", "search_analytics",
  "player_errors", "daily_stats", "rate_limits",
]

async function importTable(tableName, tableData) {
  if (!tableData || !tableData.data || tableData.data.length === 0) {
    console.log(`??????  Skipping ${tableName}: No data`)
    return { imported: 0, skipped: 0, errors: 0 }
  }

  console.log(`\n???? Importing ${tableName} (${tableData.data.length} records)...`)
  
  // Get actual table columns from database
  const actualColumns = await getTableColumns(tableName)
  
  if (actualColumns.size === 0) {
    console.log(`??????  Table ${tableName} doesn't exist, skipping...`)
    return { imported: 0, skipped: tableData.data.length, errors: 0 }
  }

  let imported = 0
  let skipped = 0
  let errors = 0

  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    await client.query('SET session_replication_role = replica') // Disable FK checks

    for (const record of tableData.data) {
      try {
        // Filter to only columns that exist in the table
        const validColumns = Object.keys(record).filter(col => actualColumns.has(col))
        
        if (validColumns.length === 0) {
          skipped++
          continue
        }

        const values = validColumns.map(col => escapeSqlString(record[col]))
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
        
        const query = `INSERT INTO ${tableName} (${validColumns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`
        
        await client.query(query, validColumns.map(col => record[col]))
        imported++
      } catch (error) {
        errors++
        if (errors <= 5) { // Only show first 5 errors
          console.error(`  ??? Error on record:`, error.message.substring(0, 100))
        }
      }
    }

    await client.query('SET session_replication_role = origin')
    await client.query('COMMIT')
    
    console.log(`  ??? ${tableName}: ${imported} imported, ${skipped} skipped, ${errors} errors`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`  ??? Failed to import ${tableName}:`, error.message)
    errors += tableData.data.length
  } finally {
    client.release()
  }

  return { imported, skipped, errors }
}

async function main() {
  console.log('???? Starting smart import to Contabo...\n')
  
  let totalImported = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const tableName of importOrder) {
    const tableData = exportData.tables[tableName]
    const result = await importTable(tableName, tableData)
    totalImported += result.imported
    totalSkipped += result.skipped
    totalErrors += result.errors
  }

  // Fix sequences
  console.log('\n???? Fixing sequences...')
  const client = await pool.connect()
  try {
    await client.query(`SELECT setval('movies_id_seq', COALESCE((SELECT MAX(id) FROM movies), 1), true)`)
    await client.query(`SELECT setval('genres_id_seq', COALESCE((SELECT MAX(id) FROM genres), 1), true)`)
    await client.query(`SELECT setval('actors_id_seq', COALESCE((SELECT MAX(id) FROM actors), 1), true)`)
  } catch (error) {
    console.error('Warning: Could not fix sequences:', error.message)
  } finally {
    client.release()
  }

  console.log('\n' + '='.repeat(50))
  console.log('??? IMPORT COMPLETE!')
  console.log(`   Imported: ${totalImported} records`)
  console.log(`   Skipped: ${totalSkipped} records`)
  console.log(`   Errors: ${totalErrors} records`)
  console.log('='.repeat(50))

  await pool.end()
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

