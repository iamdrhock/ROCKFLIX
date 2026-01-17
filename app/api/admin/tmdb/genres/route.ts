import { type NextRequest, NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

const TMDB_API_KEY = process.env.TMDB_API_KEY

export const GET = adminRoute(async ({ request }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type") || "movie"

    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: "TMDB API key not configured" }, { status: 500 })
    }

    const endpoint = type === "tv" ? "genre/tv/list" : "genre/movie/list"
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}`

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 3600 } // Cache for 1 hour
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        return NextResponse.json({ error: "TMDB API error" }, { status: response.status })
      }

      const data = await response.json()
      return NextResponse.json(data)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error("[v0] TMDB genres request timed out")
        return NextResponse.json({ error: "Request timeout" }, { status: 504 })
      }
      throw fetchError
    }
  } catch (error) {
    console.error("[v0] TMDB genres error:", error)
    return NextResponse.json({ error: "Failed to fetch genres from TMDB" }, { status: 500 })
  }
})
