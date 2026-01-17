#!/usr/bin/env node

/**
 * Convert JSON export to SQL INSERT statements
 * Splits output into chunks under 2MB for Adminer import
 * 
 * Usage: node scripts/convert-json-to-sql.js <input.json> [output_prefix]
 */

const fs = require('fs')
const path = require('path')

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
    // JSONB objects
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  
  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }
  
  // String - escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`
}

const inputFile = process.argv[2]
const outputPrefix = process.argv[3] || 'import'

if (!inputFile) {
  console.error('Usage: node convert-json-to-sql.js <input.json> [output_prefix]')
  process.exit(1)
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`)
  process.exit(1)
}

console.log(`Reading ${inputFile}...`)
const exportData = JSON.parse(fs.readFileSync(inputFile, 'utf8'))

if (!exportData.tables) {
  console.error('Error: Invalid export data format')
  process.exit(1)
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

let currentFile = 1
let currentSize = 0
const maxFileSize = 1.8 * 1024 * 1024 // 1.8MB to be safe
let currentStream = null

function getNextFile() {
  if (currentStream) {
    currentStream.end()
    currentStream = null
  }
  const filename = `${outputPrefix}_part${currentFile}.sql`
  const filepath = path.join(process.cwd(), filename)
  currentStream = fs.createWriteStream(filepath)
  currentFile++
  currentSize = 0
  
  const header = `-- SQL Import Script Part ${currentFile - 1} for Contabo PostgreSQL\n`
  currentStream.write(header)
  currentSize += Buffer.byteLength(header, 'utf8')
  
  console.log(`Creating file: ${filepath}`)
  return filename
}

function writeToCurrentFile(sql) {
  const sqlSize = Buffer.byteLength(sql, 'utf8')
  
  if (currentSize + sqlSize > maxFileSize && currentStream) {
    getNextFile()
  }
  
  if (!currentStream) {
    getNextFile()
  }
  
  currentStream.write(sql)
  currentSize += sqlSize
}

console.log('Converting to SQL...')

for (const tableName of importOrder) {
  const tableData = exportData.tables[tableName]
  
  if (!tableData || !tableData.data || tableData.data.length === 0) {
    continue
  }

  const sql = `-- Table ${tableName}: ${tableData.data.length} records\nBEGIN;\nSET session_replication_role = 'replica';\n\n`
  writeToCurrentFile(sql)

  for (const record of tableData.data) {
    const columns = Object.keys(record)
    const values = columns.map(col => escapeSqlString(record[col]))
    
    const insertSql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;\n`
    writeToCurrentFile(insertSql)
  }

  writeToCurrentFile(`SET session_replication_role = 'origin';\nCOMMIT;\n\n`)
  console.log(`??? Converted ${tableName}: ${tableData.data.length} records`)
}

// Fix sequences in the last file
const sequencesSql = `-- Fix sequences\nSELECT setval('movies_id_seq', COALESCE((SELECT MAX(id) FROM movies), 1), true);\nSELECT setval('genres_id_seq', COALESCE((SELECT MAX(id) FROM genres), 1), true);\nSELECT setval('actors_id_seq', COALESCE((SELECT MAX(id) FROM actors), 1), true);\n`
writeToCurrentFile(sequencesSql)

if (currentStream) {
  currentStream.end()
  currentStream = null
}

console.log(`\n??? Conversion complete! Generated ${currentFile - 1} SQL file(s):`)
for (let i = 1; i < currentFile; i++) {
  const filename = `${outputPrefix}_part${i}.sql`
  const filepath = path.join(process.cwd(), filename)
  if (fs.existsSync(filepath)) {
    const stats = fs.statSync(filepath)
    console.log(`  - ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
  } else {
    console.log(`  - ${filename} (created)`)
  }
}

console.log('\nNext steps:')
console.log('1. Import each SQL file in Adminer (they are under 2MB each)')
console.log('2. Import them in order: part1.sql, then part2.sql, etc.')
console.log('3. Make sure to import all parts!')

