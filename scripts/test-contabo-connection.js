const { Pool } = require('pg')

const pool = new Pool({
  user: 'postgres',
  password: 'x70wIAAISfu4pqmo',
  host: '45.130.104.103',
  port: 5432,
  database: 'postgres',
  ssl: false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

async function test() {
  try {
    console.log('Testing connection to Contabo...')
    const result = await pool.query('SELECT version()')
    console.log('SUCCESS:', result.rows[0].version)
    
    // Test multiple queries to check pool behavior
    console.log('Testing pool with multiple queries...')
    const queries = [
      pool.query('SELECT COUNT(*) as count FROM genres'),
      pool.query('SELECT COUNT(*) as count FROM countries'),
      pool.query('SELECT COUNT(*) as count FROM tags'),
    ]
    
    const results = await Promise.all(queries)
    console.log('Genres:', results[0].rows[0].count)
    console.log('Countries:', results[1].rows[0].count)
    console.log('Tags:', results[2].rows[0].count)
    
    await pool.end()
    console.log('Connection test PASSED')
    process.exit(0)
  } catch (error) {
    console.error('ERROR:', error.message)
    console.error('Code:', error.code)
    await pool.end()
    process.exit(1)
  }
}

test()

