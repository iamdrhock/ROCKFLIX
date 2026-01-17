import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchDownloadLinksFromContabo } from "@/lib/database/contabo-queries"

// GET - Fetch download links for a specific movie (public endpoint)
export async function GET(request: NextRequest, { params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId: paramId } = await params
    const movieId = Number.parseInt(paramId, 10)

    if (Number.isNaN(movieId) || movieId <= 0) {
      return NextResponse.json({ error: "Invalid movie ID" }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const episodeIdParam = searchParams.get("episodeId")
    const episodeId = episodeIdParam ? Number.parseInt(episodeIdParam) : undefined

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log(`[download-links] Fetching from Contabo: movieId=${movieId}, episodeId=${episodeId || 'null'}`)
      const data = await fetchDownloadLinksFromContabo(movieId, episodeId)
      console.log(`[download-links] Returning ${data.length} links from Contabo`)
      return NextResponse.json({ data })
    }

    // Fallback to Supabase
    const supabase = await createClient()

    let query = supabase
      .from("download_links")
      .select("*")
      .eq("movie_id", movieId)
      .eq("status", "active")
      .order("quality", { ascending: true })

    // If episode_id is provided, get links for that specific episode
    if (episodeId) {
      query = query.eq("episode_id", episodeId)
    } else {
      // For movies, get links where episode_id is null
      query = query.is("episode_id", null)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching download links:", error)
      return NextResponse.json({ error: "Failed to fetch download links" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("[v0] Error in download links GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
