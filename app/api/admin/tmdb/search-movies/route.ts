import { type NextRequest, NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

const TMDB_API_KEY = process.env.TMDB_API_KEY

export const GET = adminRoute(async ({ request }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query") || ""
    const page = searchParams.get("page") || "1"

    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: "TMDB API key not configured" }, { status: 500 })
    }

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`

    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] TMDB search movies error:", error)
    return NextResponse.json({ error: "Failed to search movies from TMDB" }, { status: 500 })
  }
})
