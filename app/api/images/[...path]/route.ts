import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { lookup } from "mime-types"

/**
 * API route to serve images from public/uploads/ directory
 * This bypasses Next.js Image optimization for local files
 * Catch-all route: /api/images/posters/file.jpg -> serves public/uploads/posters/file.jpg
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const pathParts = (await params).path
    if (!pathParts || pathParts.length === 0) {
      return new NextResponse("Image path required", { status: 400 })
    }

    // Reconstruct the path (e.g., ["posters", "poster-123.jpg"] -> "posters/poster-123.jpg")
    const imagePath = pathParts.join("/")
    
    // Security: Prevent directory traversal
    if (imagePath.includes("..") || imagePath.startsWith("/")) {
      return new NextResponse("Invalid image path", { status: 400 })
    }

    const fullPath = path.join(process.cwd(), "public", "uploads", imagePath)
    
    // Verify file exists and is within public/uploads directory
    const normalizedPath = path.normalize(fullPath)
    const publicUploadsPath = path.normalize(path.join(process.cwd(), "public", "uploads"))
    
    if (!normalizedPath.startsWith(publicUploadsPath)) {
      return new NextResponse("Invalid image path", { status: 403 })
    }

    try {
      const fileBuffer = await fs.readFile(normalizedPath)
      const stats = await fs.stat(normalizedPath)
      
      // Determine content type
      const contentType = lookup(normalizedPath) || "image/jpeg"
      
      console.log(`[v0] ✅ Image served: /api/images/${imagePath} (${stats.size} bytes, ${contentType})`)
      
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": stats.size.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    } catch (fileError: any) {
      if (fileError.code === "ENOENT") {
        console.error(`[v0] ❌ Image not found: ${normalizedPath}`)
        return new NextResponse("Image not found", { status: 404 })
      }
      throw fileError
    }
  } catch (error) {
    console.error("[v0] ❌ Error serving image:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

