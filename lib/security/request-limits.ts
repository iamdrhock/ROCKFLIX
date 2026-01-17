import type { NextRequest } from "next/server"

/**
 * Maximum request body size in bytes
 */
const MAX_REQUEST_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Check if request body size is within limits
 */
export function checkRequestSize(request: NextRequest): { valid: boolean; response?: Response } {
  const contentLength = request.headers.get("content-length")
  
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10)
    
    if (size > MAX_REQUEST_SIZE) {
      return {
        valid: false,
        response: new Response(
          JSON.stringify({
            error: "Request too large",
            message: `Request body exceeds maximum size of ${MAX_REQUEST_SIZE / 1024 / 1024}MB`,
          }),
          {
            status: 413,
            headers: { "Content-Type": "application/json" },
          },
        ),
      }
    }
  }

  return { valid: true }
}

/**
 * Maximum input field lengths
 */
export const MAX_LENGTHS = {
  comment: 2000,
  post: 500,
  postComment: 1000,
  searchQuery: 100,
  username: 20,
  email: 254,
  url: 2048,
  title: 200,
  description: 5000,
} as const

/**
 * Maximum query result limits to prevent resource exhaustion
 */
export const MAX_QUERY_LIMITS = {
  // Pagination limits
  defaultPageSize: 50,
  maxPageSize: 200,
  maxAdminPageSize: 1000,
  
  // Result set limits for queries without explicit pagination
  maxMoviesInQuery: 10000,
  maxAnalyticsRecords: 50000,
  maxSearchAnalytics: 20000,
  maxTrendingAnalytics: 100000,
  maxNotifications: 500,
  maxActorsInQuery: 1000, // For .in() queries
  maxAdPositions: 50,
  maxBlogPosts: 200,
  maxPages: 200,
  
  // Batch processing limits
  maxBatchSize: 1000, // For Supabase .in() operations
} as const

/**
 * Enforce maximum limit on pagination parameters
 */
export function enforcePaginationLimit(
  requestedLimit: number | null | undefined,
  maxLimit: number = MAX_QUERY_LIMITS.maxPageSize,
  defaultLimit: number = MAX_QUERY_LIMITS.defaultPageSize,
): number {
  if (!requestedLimit || requestedLimit <= 0) {
    return defaultLimit
  }
  return Math.min(requestedLimit, maxLimit)
}

/**
 * Validate input length
 */
export function validateLength(
  value: string,
  field: keyof typeof MAX_LENGTHS,
  fieldName?: string,
): { valid: boolean; error?: string } {
  const maxLength = MAX_LENGTHS[field]
  const name = fieldName || field

  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${name} must be ${maxLength} characters or less`,
    }
  }

  return { valid: true }
}

