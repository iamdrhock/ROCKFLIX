#!/usr/bin/env node

/**
 * Verify DigitalOcean Database
 * This script connects to your DigitalOcean PostgreSQL database
 * and shows you all tables, record counts, and sample data
 */

const { Pool } = require('pg')

// DigitalOcean connection details from your scripts
const DO_DB_URL = process.env.DATABASE_URL ||
  'postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require'

console.log('🔍 VERIFYING DIGITALOCEAN DATABASE')
console.log('=====================================\n')

// Parse connection URL to mask password in logs
const url = new URL(DO_DB_URL.replace(/^postgresql:\/\//, 'http://'))
console.log(`Host: ${url.hostname}`)
console.log(`Port: ${url.port}`)
console.log(`Database: ${url.pathname.replace('/', '')}`)
console.log(`User: ${url.username}`)
console.log('')

const pool = new Pool({
  connectionString: DO_DB_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
})

async function main() {
  const client = await pool.connect()

  try {
    // 1. Check connection
    console.log('✅ Connected to DigitalOcean database!\n')

    // 2. List all tables
    console.log('📊 TABLES IN DATABASE:')
    console.log('─'.repeat(60))
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `)

    const tables = tablesResult.rows.map(row => row.table_name)
    console.log(`Found ${tables.length} tables:\n`)

    // 3. Get record counts for each table
    console.log('📈 RECORD COUNTS:')
    console.log('─'.repeat(60))

    const counts = {}
    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`)
        const count = parseInt(countResult.rows[0].count)
        counts[table] = count
        console.log(`${table.padEnd(35)} ${count.toLocaleString().padStart(10)} records`)
      } catch (error) {
        console.log(`${table.padEnd(35)} ERROR: ${error.message}`)
        counts[table] = 0
      }
    }

    // 4. Total records
    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0)
    console.log('─'.repeat(60))
    console.log(`TOTAL: ${totalRecords.toLocaleString()} records across ${tables.length} tables\n`)

    // 5. Check key tables with sample data
    console.log('🔑 KEY TABLES SAMPLE DATA:')
    console.log('─'.repeat(60))

    const keyTables = ['movies', 'series', 'genres', 'actors', 'site_settings', 'admin_users', 'comments', 'posts']
    for (const table of keyTables) {
      if (tables.includes(table)) {
        const count = counts[table]
        console.log(`\n${table.toUpperCase()} (${count} records):`)

        if (count > 0) {
          try {
            let query = `SELECT * FROM ${table} LIMIT 3`

            // Special handling for movies to show both movies and series
            if (table === 'movies') {
              query = `SELECT id, title, type, views, created_at FROM ${table} WHERE type = 'movie' LIMIT 2`
              const seriesQuery = `SELECT id, title, type, views, created_at FROM ${table} WHERE type = 'series' LIMIT 2`

              const movieResult = await client.query(query)
              const seriesResult = await client.query(seriesQuery)

              console.log('  Movies:')
              movieResult.rows.forEach(row => {
                console.log(`    - ID: ${row.id}, Title: ${row.title?.substring(0, 50)} || Views: ${row.views}`)
              })

              console.log('  Series:')
              seriesResult.rows.forEach(row => {
                console.log(`    - ID: ${row.id}, Title: ${row.title?.substring(0, 50)} || Views: ${row.views}`)
              })
            } else {
              const result = await client.query(query)
              result.rows.slice(0, 3).forEach(row => {
                const preview = JSON.stringify(row).substring(0, 100)
                console.log(`    ${preview}...`)
              })
            }
          } catch (error) {
            console.log(`    ERROR: ${error.message}`)
          }
        }
      }
    }

    // 6. Check site_settings structure
    console.log('\n⚙️  SITE_SETTINGS COLUMNS:')
    console.log('─'.repeat(60))
    if (tables.includes('site_settings')) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'site_settings'
        ORDER BY ordinal_position;
      `)
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(35)} ${row.data_type}`)
      })
    }

    // 7. Check players table structure
    console.log('\n🎬 PLAYERS TABLE STRUCTURE:')
    console.log('─'.repeat(60))
    if (tables.includes('players')) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'players'
        ORDER BY ordinal_position;
      `)
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name.padEnd(35)} ${row.data_type}`)
      })

      // Show actual data
      const playersResult = await client.query(`SELECT * FROM players LIMIT 5`)
      console.log(`\n  Players data (${playersResult.rows.length} rows):`)
      playersResult.rows.forEach(row => {
        console.log(`    ${JSON.stringify(row)}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ VERIFICATION COMPLETE!')
    console.log('='.repeat(60))
    console.log(`\nYour DigitalOcean database has:`)
    console.log(`  - ${tables.length} tables`)
    console.log(`  - ${totalRecords.toLocaleString()} total records`)
    console.log(`\nThis is your ACTIVE database. Migration should be FROM here TO Contabo.`)

  } catch (error) {
    console.error('\n❌ ERROR:', error.message)
    console.error('\nDetails:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

