/**
 * Migrate site_settings from Supabase to Contabo
 * This script will copy all settings data from Supabase to Contabo
 */

const { createClient } = require('@supabase/supabase-js')
const { Pool } = require('pg')

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Contabo connection
const contaboUrl = process.env.CONTABO_DATABASE_URL || process.env.DATABASE_URL
const pool = new Pool({
  connectionString: contaboUrl,
  ssl: contaboUrl?.includes('localhost') ? false : { rejectUnauthorized: false }
})

async function migrateSettings() {
  try {
    console.log('???? Starting settings migration from Supabase to Contabo...\n')

    // 1. Fetch settings from Supabase
    console.log('???? Fetching settings from Supabase...')
    const { data: supabaseSettings, error: supabaseError } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (supabaseError) {
      console.error('??? Error fetching from Supabase:', supabaseError)
      throw supabaseError
    }

    if (!supabaseSettings) {
      console.log('??????  No settings found in Supabase')
      return
    }

    console.log('??? Settings fetched from Supabase:')
    console.log(`   - Site Title: ${supabaseSettings.site_title}`)
    console.log(`   - Footer Text: ${supabaseSettings.footer_text}`)
    console.log(`   - Has Header Menu: ${!!supabaseSettings.header_menu}`)
    console.log(`   - Has Footer Links: ${!!supabaseSettings.footer_links}`)
    console.log(`   - Has Quick Links: ${!!supabaseSettings.quick_links}\n`)

    // 2. Check if settings exist in Contabo
    console.log('???? Checking Contabo database...')
    const checkResult = await pool.query('SELECT COUNT(*) as count FROM site_settings WHERE id = $1', [1])
    const exists = Number.parseInt(checkResult.rows[0].count, 10) > 0

    if (exists) {
      console.log('??????  Settings already exist in Contabo. Updating...\n')
    } else {
      console.log('???? No settings found in Contabo. Creating new...\n')
    }

    // 3. Prepare data for insertion/update
    const jsonbColumns = ['header_menu', 'footer_links', 'quick_links', 'social_links']
    const updateFields = []
    const values = []
    let paramIndex = 1

    // Build UPDATE or INSERT query
    for (const [key, value] of Object.entries(supabaseSettings)) {
      if (key === 'id' || key === 'created_at') continue

      if (jsonbColumns.includes(key)) {
        // Handle JSONB columns
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value || [])
        updateFields.push(`"${key}" = $${paramIndex}::jsonb`)
        values.push(jsonValue)
      } else {
        // Regular columns
        updateFields.push(`"${key}" = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    }

    // Add updated_at
    updateFields.push(`"updated_at" = $${paramIndex}`)
    values.push(new Date().toISOString())
    paramIndex++

    if (exists) {
      // UPDATE
      values.push(1) // id
      const updateSql = `
        UPDATE site_settings 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `
      console.log('???? Updating settings in Contabo...')
      const result = await pool.query(updateSql, values)
      console.log('??? Settings updated successfully!\n')
    } else {
      // INSERT
      const insertFields = ['id', ...Object.keys(supabaseSettings).filter(k => k !== 'id' && k !== 'created_at'), 'updated_at']
      const insertValues = [1, ...values]
      const placeholders = insertFields.map((_, i) => `$${i + 1}`).join(', ')
      
      const insertSql = `
        INSERT INTO site_settings (${insertFields.map(f => `"${f}"`).join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `
      console.log('???? Inserting settings into Contabo...')
      const result = await pool.query(insertSql, insertValues)
      console.log('??? Settings inserted successfully!\n')
    }

    // 4. Verify migration
    console.log('???? Verifying migration...')
    const verifyResult = await pool.query('SELECT * FROM site_settings WHERE id = $1', [1])
    const contaboSettings = verifyResult.rows[0]

    console.log('??? Verification complete:')
    console.log(`   - Site Title: ${contaboSettings.site_title}`)
    console.log(`   - Footer Text: ${contaboSettings.footer_text}`)
    console.log(`   - Has Header Menu: ${!!contaboSettings.header_menu}`)
    console.log(`   - Has Footer Links: ${!!contaboSettings.footer_links}`)
    console.log(`   - Has Quick Links: ${!!contaboSettings.quick_links}\n`)

    console.log('???? Migration completed successfully!')

  } catch (error) {
    console.error('??? Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// Run migration
migrateSettings()
  .then(() => {
    console.log('\n??? Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n??? Script failed:', error)
    process.exit(1)
  })

