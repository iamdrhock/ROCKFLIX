import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { getConnectedRedis } from "@/lib/redis-client"

export const GET = adminRoute(async () => {
  try {
    const redis = await getConnectedRedis()
    if (!redis) {
      return NextResponse.json({
        enabled: false,
        message: "Redis not configured",
      })
    }

    // Get cache statistics
    const allKeys = await redis.keys("*")
    const movieKeys = await redis.keys("movie:*")
    const trendingKeys = await redis.keys("trending:*")
    const genreKeys = await redis.keys("genre:*")

    return NextResponse.json({
      enabled: true,
      total_keys: allKeys.length,
      movie_cache: movieKeys.length,
      trending_cache: trendingKeys.length,
      genre_cache: genreKeys.length,
      cache_patterns: {
        movies: movieKeys.slice(0, 5),
        trending: trendingKeys.slice(0, 5),
        genres: genreKeys.slice(0, 5),
      },
    })
  } catch (error) {
    console.error("[v0] Error getting cache stats:", error)
    return NextResponse.json({ error: "Failed to get cache stats" }, { status: 500 })
  }
})
