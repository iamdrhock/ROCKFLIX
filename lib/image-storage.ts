import { put, del } from "./local-storage"
import { compressImage, blobToBuffer } from "./image-compression"

/**
 * Downloads an image from a URL and saves it to local storage (public/uploads/)
 * @param imageUrl - The external image URL (TMDB/IMDB)
 * @param filename - The desired filename (e.g., 'poster-71912.jpg')
 * @param folder - Optional folder path (e.g., 'posters', 'backdrops', 'actors')
 * @returns The local storage URL or null if failed
 */
export async function downloadAndStoreImage(
  imageUrl: string | null,
  filename: string,
  folder = "images",
): Promise<string | null> {
  if (!imageUrl) {
    console.warn(`[v0] downloadAndStoreImage: No imageUrl provided for filename: ${filename}`)
    return null
  }

  try {
    console.log(`[v0] Downloading image: ${imageUrl} to ${folder}/${filename}`)

    // Download the image
    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    let response: Response
    try {
      response = await fetch(imageUrl, { signal: controller.signal })
      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error(`[v0] ❌ Image download timed out after 30 seconds: ${imageUrl}`)
      } else {
        console.error(`[v0] ❌ Failed to download image: ${fetchError.message}`)
        console.error(`[v0] URL was: ${imageUrl}`)
      }
      return null // Return null to indicate failure
    }

    if (!response.ok) {
      console.error(`[v0] ❌ Failed to download image: ${response.statusText} (Status: ${response.status})`)
      console.error(`[v0] URL was: ${imageUrl}`)
      return null // Return null to indicate failure
    }

    const blob = await response.blob()
    const contentType = response.headers.get("content-type") || "image/jpeg"

    console.log(`[v0] Image downloaded successfully, size: ${blob.size} bytes, type: ${contentType}`)

    const originalBuffer = await blobToBuffer(blob)
    const compressedBuffer = await compressImage(originalBuffer)

    console.log(`[v0] Image compressed: ${originalBuffer.length} -> ${compressedBuffer.length} bytes`)

    // Save to local storage (public/uploads/)
    const filePath = `${folder}/${filename}`
    console.log(`[v0] Saving to local storage: ${filePath}`)
    
    const result = await put(filePath, compressedBuffer, {
      access: "public",
      contentType,
    })

    const url = result?.url
    console.log(`[v0] put() returned result:`, JSON.stringify(result))
    
    if (!url) {
      console.error(`[v0] ❌ ERROR: put() returned no URL! Result:`, result)
      console.error(`[v0] ❌ Failed to save image to local storage`)
      return null // Return null instead of fallback URL - we'll handle fallback in import logic
    }
    
    if (!url.startsWith('/uploads/')) {
      console.error(`[v0] ❌ ERROR: URL format incorrect! Expected /uploads/..., got: ${url}`)
      console.error(`[v0] ❌ Invalid URL format from local storage`)
      return null // Return null instead of fallback URL
    }
    
    console.log(`[v0] ✅ Image stored successfully to local storage: ${url}`)
    return url
  } catch (error) {
    console.error("[v0] ❌ Error storing image:", error)
    console.error("[v0] Error details:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error) {
      console.error("[v0] Error stack:", error.stack)
    }
    // Return null to indicate failure - let import logic handle fallback
    console.error(`[v0] ❌ Image storage failed completely`)
    return null
  }
}

/**
 * Generates a safe filename from a title and ID
 */
export function generateImageFilename(
  id: string | number,
  type: "poster" | "backdrop" | "actor" | "episode",
  extension = "jpg",
): string {
  return `${type}-${id}-${Date.now()}.${extension}`
}

/**
 * Extracts the file extension from a URL
 */
export function getImageExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp)/)
  return match ? match[1] : "jpg"
}

/**
 * Deletes an image from local storage
 * @param imageUrl - The local storage URL to delete
 * @returns true if successful, false otherwise
 */
export async function deleteImage(imageUrl: string | null): Promise<boolean> {
  if (!imageUrl) return false

  try {
    // Only delete if it's a local storage URL (not external URLs like TMDB)
    if (!imageUrl.startsWith("/uploads/") && !imageUrl.includes("localhost")) {
      console.log(`[v0] Skipping deletion of external URL: ${imageUrl}`)
      return false
    }

    console.log(`[v0] Deleting image from local storage: ${imageUrl}`)
    await del(imageUrl)
    console.log(`[v0] Image deleted successfully`)
    return true
  } catch (error) {
    console.error("[v0] Error deleting image:", error)
    return false
  }
}

/**
 * Deletes multiple images from local storage
 * @param imageUrls - Array of local storage URLs to delete
 */
export async function deleteImages(imageUrls: (string | null)[]): Promise<void> {
  const validUrls = imageUrls.filter((url): url is string => url !== null)

  if (validUrls.length === 0) {
    console.log("[v0] No images to delete")
    return
  }

  console.log(`[v0] Deleting ${validUrls.length} images from local storage`)

  await Promise.all(validUrls.map((url) => deleteImage(url)))
}
