import type { NextRequest } from "next/server"

/**
 * Simple in-memory rate limiter
 * Note: For production with multiple servers, use Redis instead
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Get client identifier from request (IP address or user ID)
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }
  
  // Get IP from headers (respecting proxies)
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown"
  
  return `ip:${ip}`
}

/**
 * Check rate limit
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const resetAt = now + windowSeconds * 1000
  const key = identifier

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    // Create new entry
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  // Increment count
  entry.count++

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Rate limit middleware
 */
export function rateLimit(
  limit: number,
  windowSeconds: number,
  getIdentifier?: (request: NextRequest) => string,
) {
  return (request: NextRequest): { allowed: boolean; response?: Response } => {
    const identifier = getIdentifier
      ? getIdentifier(request)
      : getClientIdentifier(request)

    const result = checkRateLimit(identifier, limit, windowSeconds)

    if (!result.allowed) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "Too many requests",
            message: `Rate limit exceeded. Please try again after ${new Date(result.resetAt).toISOString()}`,
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": result.resetAt.toString(),
              "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
            },
          },
        ),
      }
    }

    return { allowed: true }
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Search: 30 requests per minute per IP
  search: rateLimit(30, 60),
  
  // Comments: 20 comments per minute per user
  comments: (request: NextRequest, userId?: string) => {
    const identifier = getClientIdentifier(request, userId)
    return checkRateLimit(identifier, 20, 60)
  },
  
  // Posts: 5 posts per minute per user
  posts: (request: NextRequest, userId?: string) => {
    const identifier = getClientIdentifier(request, userId)
    return checkRateLimit(identifier, 5, 60)
  },
  
  // Admin actions: 60 requests per minute per admin
  admin: (request: NextRequest, userId?: string) => {
    const identifier = getClientIdentifier(request, userId)
    return checkRateLimit(identifier, 60, 60)
  },
  
  // Login attempts: 5 attempts per 15 minutes per IP
  login: rateLimit(5, 15 * 60),
}

