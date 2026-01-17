import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { queryContabo } from "@/lib/database/contabo-pool"

export const GET = adminRoute(async ({ request, supabase }) => {
  console.log("[v0] imported-ids API called")
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // 'movie' or 'series'
    const _t = searchParams.get("_t") // Cache-busting timestamp parameter
    console.log("[v0] Fetching imported IDs for type:", type, "cache-bust:", _t)

    const useContabo = process.env.USE_CONTABO_DB === 'true'
    
    if (useContabo) {
      // Query Contabo for TMDB IDs
      const movieType = type === "series" ? "series" : "movie"
      const result = await queryContabo<{ tmdb_id: string }>(
        'SELECT tmdb_id FROM movies WHERE type = $1 AND tmdb_id IS NOT NULL ORDER BY id DESC',
        [movieType]
      )

      console.log("[v0] Raw data from Contabo:", result.rows.length, "records")

      // Extract TMDB IDs and convert to numbers
      const tmdbIds = result.rows
        .map((item) => {
          const id = item.tmdb_id
          // Handle both string and number formats
          return typeof id === "string" ? Number.parseInt(id, 10) : id
        })
        .filter((id) => !Number.isNaN(id))

      console.log("[v0] Processed TMDB IDs:", tmdbIds.length)
      console.log("[v0] Returning", tmdbIds.length, "imported IDs from Contabo")

      return NextResponse.json({ tmdb_ids: tmdbIds })
    }

    // Use service role client to ensure we see all records, including newly inserted ones
    const serviceSupabase = createServiceRoleClient()
    
    // Query movies table for TMDB IDs based on type
    // Force a fresh query by using a unique query (the _t parameter ensures no caching)
    const { data, error } = await serviceSupabase
      .from("movies")
      .select("tmdb_id")
      .eq("type", type === "series" ? "series" : "movie")
      .not("tmdb_id", "is", null)
      .order("id", { ascending: false }) // Order by ID to ensure we get latest records

    if (error) {
      console.error("[v0] Error fetching imported IDs:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Raw data from database:", data)
    console.log("[v0] Number of records found:", data?.length || 0)

    // Extract TMDB IDs and convert to numbers
    const tmdbIds = data
      .map((item) => {
        const id = item.tmdb_id
        // Handle both string and number formats
        return typeof id === "string" ? Number.parseInt(id, 10) : id
      })
      .filter((id) => !Number.isNaN(id))

    console.log("[v0] Processed TMDB IDs:", tmdbIds)
    console.log("[v0] Returning", tmdbIds.length, "imported IDs")

    return NextResponse.json({ tmdb_ids: tmdbIds })
  } catch (error) {
    console.error("[v0] Error in imported-ids route:", error)
    return NextResponse.json({ error: "Failed to fetch imported IDs" }, { status: 500 })
  }
})
