import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { queryContabo } from "@/lib/database/contabo-pool"

export const GET = adminRoute(async ({ supabase }) => {
  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'

    let movies: any[] = []

    if (useContabo) {
      // Get first 5 movies from Contabo
      const result = await queryContabo<{
        id: number
        title: string
        imdb_id: string | null
        tmdb_id: string | null
        type: string
      }>(
        `SELECT id, title, imdb_id, tmdb_id, type
         FROM movies
         ORDER BY id
         LIMIT 5`
      )
      movies = result.rows
    } else {
      // Get first 5 movies to see what data looks like
      const { data, error } = await supabase.from("movies").select("id, title, imdb_id, tmdb_id, type").limit(5)

      if (error) {
        console.error("[v0] Error fetching sample movies:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      movies = data || []
    }

    console.log("[v0] Sample movies from database:", movies)

    return NextResponse.json({
      count: movies.length,
      movies: movies,
      message: "Check server logs for detailed output",
    })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
})
