import fs from "fs/promises"
import path from "path"

/**
 * Local file storage implementation for VPS deployment
 * Stores files in the public/uploads directory
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

// Create upload directories on startup
const ensureUploadDirs = async () => {
  const dirs = [
    path.join(UPLOAD_DIR, "images"),
    path.join(UPLOAD_DIR, "posters"),
    path.join(UPLOAD_DIR, "backdrops"),
    path.join(UPLOAD_DIR, "actors"),
    path.join(UPLOAD_DIR, "episodes"),
    path.join(UPLOAD_DIR, "blog"),
    path.join(UPLOAD_DIR, "profile-pictures"),
    path.join(UPLOAD_DIR, "talkflix"),
  ]

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch (error) {
      console.error(`[v0] Error creating directory ${dir}:`, error)
    }
  }
}

// Initialize directories
ensureUploadDirs()

/**
 * Upload a file to local storage
 * @param filePath - Path where file should be stored (e.g., 'blog/image.jpg')
 * @param buffer - File buffer to save
 * @param options - Upload options (access level, contentType)
 * @returns Object with url property pointing to the file
 */
export async function put(
  filePath: string,
  buffer: Buffer | Blob,
  options?: { access?: string; contentType?: string },
): Promise<{ url: string }> {
  try {
    // Convert Blob to Buffer if needed
    let fileBuffer: Buffer
    if (buffer instanceof Blob) {
      const arrayBuffer = await buffer.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
    } else {
      fileBuffer = buffer
    }

    const fullPath = path.join(UPLOAD_DIR, filePath)
    const directory = path.dirname(fullPath)

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true })

    // Write file
    await fs.writeFile(fullPath, fileBuffer)

    // Verify file was written successfully
    try {
      const stats = await fs.stat(fullPath)
      if (stats.size === 0) {
        throw new Error(`File written but has 0 bytes: ${fullPath}`)
      }
      console.log(`[v0] ✅ File verified on disk: ${fullPath} (${stats.size} bytes)`)
    } catch (verifyError) {
      console.error(`[v0] ❌ File verification failed:`, verifyError)
      throw new Error(`File verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`)
    }

    // Return URL relative to public directory
    const url = `/uploads/${filePath}`
    console.log(`[v0] ✅ File saved to local storage: ${url} -> ${fullPath}`)

    return { url }
  } catch (error) {
    console.error("[v0] Error saving file to local storage:", error)
    throw error
  }
}

/**
 * Delete a file from local storage
 * @param fileUrl - URL or path of the file to delete
 */
export async function del(fileUrl: string): Promise<void> {
  try {
    // Convert URL to file path
    let filePath: string

    if (fileUrl.startsWith("/uploads/")) {
      // Local URL format
      filePath = path.join(process.cwd(), "public", fileUrl)
    } else if (fileUrl.startsWith("http")) {
      // Skip external URLs
      console.log(`[v0] Skipping deletion of external URL: ${fileUrl}`)
      return
    } else {
      // Direct path
      filePath = path.join(UPLOAD_DIR, fileUrl)
    }

    // Check if file exists before deleting
    try {
      await fs.access(filePath)
      await fs.unlink(filePath)
      console.log(`[v0] File deleted from local storage: ${filePath}`)
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error
      }
      console.log(`[v0] File not found, skipping deletion: ${filePath}`)
    }
  } catch (error) {
    console.error("[v0] Error deleting file from local storage:", error)
    throw error
  }
}

/**
 * List all files in local storage (optional utility)
 * @param prefix - Optional prefix to filter files
 */
export async function list(
  prefix?: string,
): Promise<{ blobs: Array<{ pathname: string; url: string; size: number }> }> {
  try {
    const targetDir = prefix ? path.join(UPLOAD_DIR, prefix) : UPLOAD_DIR
    const files = await fs.readdir(targetDir, { recursive: true, withFileTypes: true })

    const blobs = await Promise.all(
      files
        .filter((file) => file.isFile())
        .map(async (file) => {
          const fullPath = path.join(file.path, file.name)
          const stats = await fs.stat(fullPath)
          const relativePath = path.relative(UPLOAD_DIR, fullPath)
          return {
            pathname: relativePath,
            url: `/uploads/${relativePath}`,
            size: stats.size,
          }
        }),
    )

    return { blobs }
  } catch (error) {
    console.error("[v0] Error listing files:", error)
    return { blobs: [] }
  }
}
