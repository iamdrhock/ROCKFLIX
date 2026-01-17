import DOMPurify from "isomorphic-dompurify"

/**
 * Security Validation Utilities
 * Use these functions to validate and sanitize user inputs
 */

// Sanitize HTML content to prevent XSS attacks
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href", "target"],
  })
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

// Validate username (alphanumeric, underscore, 3-20 chars)
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

// Validate TMDB ID (must be positive integer)
export function isValidTmdbId(id: string | number): boolean {
  const numId = typeof id === "string" ? Number.parseInt(id, 10) : id
  return !isNaN(numId) && numId > 0 && Number.isInteger(numId)
}

// Sanitize search query
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML
    .substring(0, 100) // Limit length
}

// Validate URL (must be http/https)
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

// Rate limiting helper (to be used with Redis)
export async function checkRateLimit(
  identifier: string,
  limit = 100,
  windowSeconds = 60,
): Promise<{ allowed: boolean; remaining: number }> {
  // Implementation note: Use Upstash Redis in production
  // This is a placeholder - implement with actual Redis in Cursor

  // Example Redis implementation:
  // const redis = Redis.fromEnv()
  // const key = `rate_limit:${identifier}`
  // const current = await redis.incr(key)
  // if (current === 1) await redis.expire(key, windowSeconds)
  // return { allowed: current <= limit, remaining: Math.max(0, limit - current) }

  return { allowed: true, remaining: limit }
}

// Validate password strength
export function isStrongPassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters")
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Sanitize filename for uploads (if you add file upload feature)
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 255)
}

// Validate integer within range
export function isValidInteger(value: string | number, min = 0, max: number = Number.MAX_SAFE_INTEGER): boolean {
  const num = typeof value === "string" ? Number.parseInt(value, 10) : value
  return !isNaN(num) && Number.isInteger(num) && num >= min && num <= max
}

// Prevent SQL injection in PHP API (validation helper)
export function escapeSqlString(str: string): string {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\%]/g, (char) => {
    switch (char) {
      case "\0":
        return "\\0"
      case "\x08":
        return "\\b"
      case "\x09":
        return "\\t"
      case "\x1a":
        return "\\z"
      case "\n":
        return "\\n"
      case "\r":
        return "\\r"
      case '"':
      case "'":
      case "\\":
      case "%":
        return "\\" + char
      default:
        return char
    }
  })
}
