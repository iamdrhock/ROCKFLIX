/**
 * Site Settings Helper
 * Fetches site settings from Contabo or Supabase
 */

export async function getSiteSettings(columns?: string): Promise<any | null> {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { queryContabo } = await import('./contabo-pool')
      const sql = `SELECT ${columns || '*'} FROM site_settings LIMIT 1`
      const result = await queryContabo<any>(sql)
      return result.rows[0] || null
    } catch (error: any) {
      console.error(`[Contabo] Error fetching site settings:`, error)
      return null
    }
  }

  // Fallback to Supabase
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const selectCols = columns || '*'
  const { data, error } = await supabase
    .from("site_settings")
    .select(selectCols)
    .eq("id", 1)
    .single()

  if (error) {
    console.error("[v0] Error fetching site settings:", error)
    return null
  }

  return data
}

