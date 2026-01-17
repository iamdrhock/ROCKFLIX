import { getConnectedRedis } from "@/lib/redis-client"

export interface CacheOptions {
  ttl?: number // Time to live in seconds (default: 300 = 5 minutes)
  tags?: string[] // Cache tags for invalidation
}

/**
 * Get data from cache or execute function and cache result
 */
export async function getCached<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
  const { ttl = 300 } = options

  // If Redis is not configured, just fetch directly
  const redis = await getConnectedRedis()
  if (!redis) return fetcher()

  try {
    // Try to get from cache
    const cached = await redis.get(key)
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as T
        console.log(`[v0] Cache HIT for key: ${key}`)
        return parsed
      } catch (error) {
        console.warn(`[v0] Failed to parse cached data for key ${key}:`, error)
      }
    }

    console.log(`[v0] Cache MISS for key: ${key}, fetching data...`)

    // Fetch fresh data
    const data = await fetcher()

    // Store in cache (fire and forget)
    const serialized = JSON.stringify(data ?? null)
    redis.set(key, serialized, "EX", ttl).catch((error) => {
      console.error(`[v0] Error caching data for key ${key}:`, error)
    })

    return data
  } catch (error) {
    console.error(`[v0] Cache error for key ${key}:`, error)
    // Fallback to fetching directly
    return fetcher()
  }
}

/**
 * Invalidate cache by key or pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const redis = await getConnectedRedis()
  if (!redis) return

  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`[v0] Invalidated ${keys.length} cache keys matching: ${pattern}`)
    }
  } catch (error) {
    console.error(`[v0] Error invalidating cache for pattern ${pattern}:`, error)
  }
}

/**
 * Clear specific cache key
 */
export async function clearCache(key: string): Promise<void> {
  if (!redis) return

  try {
    await redis.del(key)
    console.log(`[v0] Cleared cache for key: ${key}`)
  } catch (error) {
    console.error(`[v0] Error clearing cache for key ${key}:`, error)
  }
}
