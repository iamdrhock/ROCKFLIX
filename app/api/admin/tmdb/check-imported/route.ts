import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { queryContabo } from "@/lib/database/contabo-pool"

export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    const body = await request.json()
    const { tmdb_ids, type } = body

    console.log("[v0] check-imported called with", tmdb_ids?.length, "IDs, type:", type)

    if (!tmdb_ids || !Array.isArray(tmdb_ids)) {
      return NextResponse.json({ error: "tmdb_ids array is required" }, { status: 400 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'
    const movieType = type === "series" ? "series" : "movie"
    const tmdbIdsAsStrings = tmdb_ids.map((id) => String(id))
    const imdbIds = tmdb_ids.map((id) => `tmdb:${id}`)

    console.log("[v0] Checking for tmdb_ids:", tmdbIdsAsStrings.slice(0, 5), "...")
    console.log("[v0] Also checking imdb_ids:", imdbIds.slice(0, 5), "...")

    let importedTmdbIds: number[] = []

    if (useContabo) {
      // Query Contabo for matching TMDB IDs
      const result = await queryContabo<{
        imdb_id: string | null
        tmdb_id: string | null
      }>(
        `SELECT imdb_id, tmdb_id
         FROM movies
         WHERE type = $1
         AND (
           tmdb_id = ANY($2::text[])
           OR imdb_id = ANY($3::text[])
         )`,
        [movieType, tmdbIdsAsStrings, imdbIds]
      )

      console.log("[v0] Database returned", result.rows.length, "matching records")

      // Extract TMDB IDs from both tmdb_id column and imdb_id column
      importedTmdbIds = result.rows
        .map((item) => {
          // First try tmdb_id column
          if (item.tmdb_id) {
            return Number.parseInt(item.tmdb_id)
          }
          // Fall back to parsing imdb_id if it has tmdb: prefix
          const match = item.imdb_id?.match(/^tmdb:(\d+)$/)
          return match ? Number.parseInt(match[1]) : null
        })
        .filter((id): id is number => id !== null && !isNaN(id))
    } else {
      // Use service role client to ensure we see all records, including newly inserted ones
      const serviceSupabase = createServiceRoleClient()
      
      const { data, error } = await serviceSupabase
        .from("movies")
        .select("imdb_id, tmdb_id")
        .eq("type", movieType)
        .or(`tmdb_id.in.(${tmdbIdsAsStrings.join(",")}),imdb_id.in.(${imdbIds.join(",")})`)

      if (error) {
        console.error("[v0] Error checking imported content:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log("[v0] Database returned", data?.length || 0, "matching records")

      // Extract TMDB IDs from both tmdb_id column and imdb_id column
      importedTmdbIds = (data || [])
        .map((item) => {
          // First try tmdb_id column
          if (item.tmdb_id) {
            return Number.parseInt(item.tmdb_id)
          }
          // Fall back to parsing imdb_id if it has tmdb: prefix
          const match = item.imdb_id?.match(/^tmdb:(\d+)$/)
          return match ? Number.parseInt(match[1]) : null
        })
        .filter((id): id is number => id !== null && !isNaN(id))
    }

    console.log("[v0] Returning", importedTmdbIds.length, "imported IDs:", importedTmdbIds.slice(0, 5))

    return NextResponse.json({ imported_ids: importedTmdbIds })
  } catch (error) {
    console.error("[v0] Error in check-imported endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
