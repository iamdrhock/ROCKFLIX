#!/usr/bin/env node

/**
 * Export from DigitalOcean Database
 * This exports ALL data from your DigitalOcean database to JSON
 * Use this as the source for migrating to Contabo
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// DigitalOcean connection
const DO_DB_URL = process.env.DATABASE_URL ||
  'postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require'

const OUTPUT_FILE = path.join(__dirname, 'digitalocean-export.json')

console.log('📦 EXPORTING FROM DIGITALOCEAN DATABASE')
console.log('========================================\n')

const pool = new Pool({
  connectionString: DO_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
})

async function exportTable(client, tableName) {
  try {
    const { rows } = await client.query(`SELECT * FROM ${tableName}`)
    return {
      count: rows.length,
      data: rows
    }
  } catch (error) {
    console.error(`  ❌ Error exporting ${tableName}:`, error.message)
    return {
      count: 0,
      data: [],
      error: error.message
    }
  }
}

async function main() {
  const client = await pool.connect()

  try {
    console.log('✅ Connected to DigitalOcean database\n')

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `)

    const tables = tablesResult.rows.map(row => row.table_name)
    console.log(`Found ${tables.length} tables to export\n`)

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        source: 'DigitalOcean PostgreSQL',
        databaseUrl: DO_DB_URL.split('@')[1]?.split('/')[0] || 'masked'
      },
      tables: {}
    }

    let totalRecords = 0

    // Export each table
    for (const table of tables) {
      process.stdout.write(`Exporting ${table}... `)
      const tableData = await exportTable(client, table)
      exportData.tables[table] = tableData
      totalRecords += tableData.count
      console.log(`✅ ${tableData.count.toLocaleString()} records`)
    }

    exportData.metadata.totalRecords = totalRecords
    exportData.metadata.totalTables = tables.length

    // Write to file
    console.log(`\n💾 Writing to ${OUTPUT_FILE}...`)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportData, null, 2))

    const fileSize = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)
    console.log(`✅ Export complete!`)
    console.log(`\n📊 Summary:`)
    console.log(`   - ${tables.length} tables`)
    console.log(`   - ${totalRecords.toLocaleString()} total records`)
    console.log(`   - File size: ${fileSize} MB`)
    console.log(`   - Output: ${OUTPUT_FILE}`)
    console.log(`\n🎯 This file is ready to import to Contabo!`)

  } catch (error) {
    console.error('\n❌ EXPORT ERROR:', error.message)
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

