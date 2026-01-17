/**
 * Helper function to convert image URLs for Next.js Image component
 * Local files in /uploads/ need to go through API route to bypass optimization
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return "/placeholder.svg"
  }

  // If it's a local upload, use API route to bypass Next.js Image optimization
  if (imageUrl.startsWith("/uploads/")) {
    // Convert /uploads/posters/file.jpg -> /api/images/posters/file.jpg
    return imageUrl.replace("/uploads/", "/api/images/")
  }

  // External URLs (TMDB, etc.) can be used directly
  return imageUrl
}

