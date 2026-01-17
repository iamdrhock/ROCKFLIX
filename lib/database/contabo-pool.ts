/**
 * Contabo PostgreSQL Connection Pool
 * 
 * This provides direct PostgreSQL connections to Contabo database
 * Use this for data queries instead of Supabase client when using Contabo
 */

import { Pool } from 'pg'

let pool: Pool | null = null

export function getContaboPool(): Pool {
  if (pool) {
    return pool
  }

  const databaseUrl = process.env.CONTABO_DATABASE_URL || process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("CONTABO_DATABASE_URL or DATABASE_URL environment variable not set")
  }

  // Parse and clean connection string
  let cleanUrl = databaseUrl.split('?')[0]
  // Add encoding parameter to connection string
  cleanUrl += '?sslmode=disable&client_encoding=UTF8'

  pool = new Pool({
    connectionString: cleanUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })
  
  // Set encoding on the pool after creation
  pool.on('connect', async (client) => {
    try {
      await client.query('SET client_encoding TO UTF8')
    } catch (err) {
      console.error('[Contabo Pool] Error setting encoding:', err)
    }
  })
  
  // Handle pool errors
  pool.on('error', (err) => {
    console.error('[Contabo Pool] Unexpected error on idle client:', err)
  })

  return pool
}

export async function queryContabo<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount?: number }> {
  const pool = getContaboPool()
  const result = await pool.query(text, params)
  return { rows: result.rows as T[], rowCount: result.rowCount }
}

