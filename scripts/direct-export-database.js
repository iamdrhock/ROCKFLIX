#!/usr/bin/env node

/**
 * Direct export script to export database from Supabase
 * 
 * Usage:
 *   node scripts/direct-export-database.js
 * 
 * This will create database-export.json in the current directory
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.production')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const tables = [
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

async function exportTable(tableName) {
  console.log(`📤 Exporting ${tableName}...`)
  
  let allData = []
  let page = 0
  const pageSize = 1000
  
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    
    if (error) {
      console.error(`   ❌ Error exporting ${tableName}:`, error.message)
      return { data: [], error: error.message }
    }
    
    if (!data || data.length === 0) {
      break
    }
    
    allData = allData.concat(data)
    console.log(`   ✅ Exported ${allData.length} records from ${tableName}...`)
    
    if (data.length < pageSize) {
      break
    }
    
    page++
  }
  
  console.log(`   ✅ Completed: ${allData.length} records from ${tableName}`)
  return { data: allData, error: null }
}

async function main() {
  console.log('🚀 Starting database export from Supabase...')
  console.log(`   URL: ${SUPABASE_URL}`)
  console.log()
  
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      version: "1.0",
      source: "Supabase",
      supabaseUrl: SUPABASE_URL,
    },
    tables: {},
  }
  
  let totalRecords = 0
  
  for (const tableName of tables) {
    const result = await exportTable(tableName)
    exportData.tables[tableName] = {
      data: result.data,
      count: result.data.length,
      error: result.error,
    }
    totalRecords += result.data.length
  }
  
  // Save to file
  const outputFile = path.join(process.cwd(), 'database-export.json')
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2))
  
  console.log()
  console.log('🎉 Export complete!')
  console.log(`   Total records: ${totalRecords}`)
  console.log(`   Tables: ${tables.length}`)
  console.log(`   Output file: ${outputFile}`)
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

