import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { getConnectedRedis } from "@/lib/redis-client"

export const POST = adminRoute(async ({ request }) => {
  try {
    const { pattern } = await request.json()

    const redis = await getConnectedRedis()
    if (!redis) {
      return NextResponse.json(
        {
          success: true,
          message: "Redis caching is not configured.",
          keys_cleared: 0,
          redis_configured: false,
        },
        { status: 200 },
      )
    }

    // Clear cache based on pattern
    const keys = await redis.keys(pattern || "*")

    if (keys.length > 0) {
      await redis.del(...keys)
      return NextResponse.json({
        success: true,
        message: `Cleared ${keys.length} cache keys`,
        keys_cleared: keys.length,
        redis_configured: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: "No cache keys found to clear",
      keys_cleared: 0,
      redis_configured: true,
    })
  } catch (error) {
    console.error("[v0] Error clearing cache:", error)
    return NextResponse.json({ error: "Failed to clear cache" }, { status: 500 })
  }
})
