// Quick script to check recent movie image URLs
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DIGITALOCEAN_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function checkMovies() {
  try {
    const result = await pool.query(`
      SELECT id, title, poster_url, backdrop_url, updated_at 
      FROM movies 
      ORDER BY updated_at DESC 
      LIMIT 5
    `)
    
    console.log('Recent Movies:')
    result.rows.forEach(movie => {
      console.log(`\nID: ${movie.id}`)
      console.log(`Title: ${movie.title}`)
      console.log(`Poster: ${movie.poster_url || 'NULL'}`)
      console.log(`Backdrop: ${movie.backdrop_url || 'NULL'}`)
      console.log(`Updated: ${movie.updated_at}`)
    })
    
    pool.end()
  } catch (error) {
    console.error('Error:', error.message)
    pool.end()
  }
}

checkMovies()

