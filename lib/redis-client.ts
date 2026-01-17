import Redis from "ioredis"

declare global {
  // eslint-disable-next-line no-var
  var __rockflixRedis: Redis | null | undefined
}

const globalRedis = globalThis as typeof globalThis & {
  __rockflixRedis?: Redis | null
}

function buildRedisClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) {
    console.warn("[v0] REDIS_URL not set; caching disabled")
    return null
  }

  const client = new Redis(url, {
    lazyConnect: true,
  })

  client.on("error", (error) => {
    console.error("[v0] Redis client error:", error)
  })

  return client
}

export function getRedisClient(): Redis | null {
  if (globalRedis.__rockflixRedis === undefined) {
    globalRedis.__rockflixRedis = buildRedisClient()
  }

  return globalRedis.__rockflixRedis ?? null
}

export async function getConnectedRedis(): Promise<Redis | null> {
  const client = getRedisClient()
  if (!client) return null

  if (client.status === "wait" || client.status === "end" || client.status === "close") {
    try {
      await client.connect()
    } catch (error) {
      console.error("[v0] Redis connection error:", error)
      return null
    }
  }

  return client
}

export type RedisClient = Redis

