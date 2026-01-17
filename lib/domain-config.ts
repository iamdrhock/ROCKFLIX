/**
 * Domain Configuration Helper
 *
 * This file helps manage cross-domain links between ROCKFLIX and TalkFlix.
 * Use this in Cursor when implementing multi-domain deployment.
 */

export const getDomainConfig = () => {
  const siteType = process.env.NEXT_PUBLIC_SITE_TYPE || "movies"

  return {
    isMoviesSite: siteType === "movies",
    isCommunitySite: siteType === "community",
    moviesUrl: process.env.NEXT_PUBLIC_MOVIES_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.tv",
    communityUrl: process.env.NEXT_PUBLIC_COMMUNITY_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://talkflix.org",
    currentSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  }
}

/**
 * Get the correct URL for a movie/series page
 * Use this when linking to movie content from TalkFlix
 */
export const getMovieUrl = (movieId: string, type: "movie" | "series" = "movie") => {
  const { moviesUrl } = getDomainConfig()
  return `${moviesUrl}/${type}/${movieId}`
}

/**
 * Get the correct URL for a community post
 * Use this when linking to TalkFlix posts from ROCKFLIX
 */
export const getCommunityUrl = (postId?: string) => {
  const { communityUrl } = getDomainConfig()
  return postId ? `${communityUrl}/community/posts/${postId}` : `${communityUrl}/community`
}

/**
 * Get the correct URL for a user profile
 * Use this for cross-domain profile links
 */
export const getProfileUrl = (username: string) => {
  const { communityUrl } = getDomainConfig()
  return `${communityUrl}/profile/${username}`
}

/**
 * Check if current request is from allowed origin
 * Use this in API routes for CORS validation
 */
export const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || []
  return allowedOrigins.includes(origin)
}

/**
 * Get CORS headers for API responses
 * Use this in API routes that need cross-domain access
 */
export const getCorsHeaders = (origin: string | null) => {
  if (!isAllowedOrigin(origin)) {
    return {}
  }

  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  }
}
