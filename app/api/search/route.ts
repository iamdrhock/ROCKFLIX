import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { trackSearch } from "@/lib/analytics"
import { sanitizeSearchQuery } from "@/lib/security/validation"
import { rateLimiters } from "@/lib/security/rate-limit"

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitCheck = rateLimiters.search(request)
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response!
    }

    const searchParams = request.nextUrl.searchParams
    const rawQuery = searchParams.get("q")
    const type = searchParams.get("type") // 'movie', 'series', or null for both
    const limit = searchParams.get("limit") || "10"

    if (!rawQuery || rawQuery.trim().length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Sanitize search query to prevent injection attacks
    const query = sanitizeSearchQuery(rawQuery)

    if (!query || query.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { searchMoviesFromContabo } = await import('@/lib/database/contabo-queries')
        const { movies, total } = await searchMoviesFromContabo(
          query,
          type === "movie" || type === "series" ? type : undefined,
          1, // API is currently just for dropdown, so page 1
          Number.parseInt(limit)
        )

        // Ensure results are valid JSON with proper encoding
        const safeResults = (movies || []).map((r: any) => ({
          id: r.id,
          title: r.title || '',
          type: r.type || 'movie',
          poster_url: r.poster_url || null,
          release_date: r.release_date || null,
          rating: r.rating || 0
        }))

        trackSearch({
          query: query,
          resultsCount: safeResults.length,
        }).catch(() => { }) // Silently fail tracking

        return NextResponse.json({ results: safeResults, total: total }, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        })
      } catch (error: any) {
        console.error("[Search API] Error:", error?.message || error)
        console.error("[Search API] Stack:", error?.stack)
        return NextResponse.json({ results: [] }, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        })
      }
    }

    // Create Supabase client for public access
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    // Build query
    let supabaseQuery = supabase
      .from("movies")
      .select("id, title, type, poster_url, release_date, rating")
      .ilike("title", `%${query}%`)
      .limit(Number.parseInt(limit))

    // Filter by type if specified
    if (type && (type === "movie" || type === "series")) {
      supabaseQuery = supabaseQuery.eq("type", type)
    }

    const { data, error } = await supabaseQuery.order("views", { ascending: false })

    if (error) {
      console.error("[v0] Search error:", error)
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }

    trackSearch({
      query: query,
      resultsCount: data?.length || 0,
    }).catch((err) => console.error("[v0] Error tracking search:", err))

    return NextResponse.json({ results: data || [] })
  } catch (error) {
    console.error("[v0] Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
