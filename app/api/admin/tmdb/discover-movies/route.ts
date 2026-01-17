import { type NextRequest, NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

const TMDB_API_KEY = process.env.TMDB_API_KEY

export const GET = adminRoute(async ({ request }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = searchParams.get("page") || "1"
    const year = searchParams.get("year") || ""
    const genre = searchParams.get("genre") || ""
    const sortBy = searchParams.get("sort_by") || "popularity.desc"

    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: "TMDB API key not configured" }, { status: 500 })
    }

    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&page=${page}&sort_by=${sortBy}`

    if (year) {
      url += `&primary_release_year=${year}`
    }

    if (genre) {
      url += `&with_genres=${genre}`
    }

    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] TMDB discover movies error:", error)
    return NextResponse.json({ error: "Failed to fetch movies from TMDB" }, { status: 500 })
  }
})
