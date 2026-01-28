import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sanitizeSearchQuery } from "@/lib/security/validation"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q") || ""

    if (!rawQuery.trim()) {
      return NextResponse.json({ results: [] })
    }

    // Sanitize search query to prevent injection attacks
    const query = sanitizeSearchQuery(rawQuery)
    
    if (!query || query.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { searchMoviesFromContabo } = await import('@/lib/database/contabo-queries')
      const results = await searchMoviesFromContabo(query, undefined, 10)
      
      // Map to expected format
      const items = Array.isArray(results) ? results : results.movies || []
      const formattedResults = items.map(movie => ({
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_url,
        type: movie.type,
        release_date: movie.release_date
      }))
      
      return NextResponse.json({ results: formattedResults })
    }

    // Fallback to Supabase
    const supabase = await createClient()

    // Search movies and series
    const { data: movies, error } = await supabase
      .from("movies")
      .select("id, title, poster_url, type, release_date")
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(10)

    if (error) {
      console.error("Error searching content:", error)
      return NextResponse.json({ error: "Failed to search content" }, { status: 500 })
    }

    return NextResponse.json({ results: movies || [] })
  } catch (error) {
    console.error("Error in search-content:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
