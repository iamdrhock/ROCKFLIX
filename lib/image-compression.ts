import sharp from "sharp"

/**
 * Compresses an image to target size range (600KB - 800KB) while maintaining quality
 * @param imageBuffer - The original image buffer
 * @param targetMinSize - Minimum target size in bytes (default: 600KB)
 * @param targetMaxSize - Maximum target size in bytes (default: 800KB)
 * @returns Compressed image buffer
 */
export async function compressImage(
  imageBuffer: Buffer,
  targetMinSize = 600 * 1024, // 600KB
  targetMaxSize = 800 * 1024, // 800KB
): Promise<Buffer> {
  const originalSize = imageBuffer.length

  if (originalSize >= targetMinSize && originalSize <= targetMaxSize) {
    console.log(`[v0] Image is ${(originalSize / 1024).toFixed(2)}KB, already in target range`)
    return imageBuffer
  }

  if (originalSize < 1024 * 1024) {
    console.log(`[v0] Image is ${(originalSize / 1024).toFixed(2)}KB, under 1MB - no compression needed`)
    return imageBuffer
  }

  console.log(`[v0] Original image size: ${(originalSize / 1024).toFixed(2)}KB, compressing to 600-800KB range...`)

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata()
  const format = metadata.format || "jpeg"

  let quality = 90
  let compressed = imageBuffer
  let bestCompressed = imageBuffer
  let bestSize = originalSize

  for (let attempt = 0; attempt < 10; attempt++) {
    let sharpInstance = sharp(imageBuffer)

    // This prevents over-compression from aggressive resizing
    if (metadata.width && metadata.width > 4000) {
      sharpInstance = sharpInstance.resize(3500, null, {
        withoutEnlargement: true,
        fit: "inside",
      })
      console.log(`[v0] Resizing from ${metadata.width}px to 3500px width`)
    }

    // Apply compression based on format
    if (format === "png") {
      compressed = await sharpInstance
        .png({
          quality,
          compressionLevel: 8,
          adaptiveFiltering: true,
        })
        .toBuffer()
    } else if (format === "webp") {
      compressed = await sharpInstance
        .webp({
          quality,
        })
        .toBuffer()
    } else {
      // Default to JPEG for all other formats
      compressed = await sharpInstance
        .jpeg({
          quality,
          mozjpeg: true,
        })
        .toBuffer()
    }

    const compressedSize = compressed.length

    console.log(`[v0] Attempt ${attempt + 1}: Quality ${quality}, Size: ${(compressedSize / 1024).toFixed(2)}KB`)

    if (compressedSize >= targetMinSize && compressedSize <= targetMaxSize) {
      console.log(`[v0] ✓ Perfect! Hit target range: ${(compressedSize / 1024).toFixed(2)}KB`)
      return compressed
    }

    // Keep track of best result so far
    const distanceFromTarget = Math.abs(compressedSize - (targetMinSize + targetMaxSize) / 2)
    const bestDistance = Math.abs(bestSize - (targetMinSize + targetMaxSize) / 2)

    if (distanceFromTarget < bestDistance) {
      bestCompressed = compressed
      bestSize = compressedSize
    }

    if (compressedSize > targetMaxSize) {
      // Too large, reduce quality
      const overage = compressedSize - targetMaxSize
      if (overage > 500 * 1024) {
        quality -= 10 // Large overage, reduce more
      } else if (overage > 200 * 1024) {
        quality -= 5 // Medium overage
      } else {
        quality -= 3 // Small overage, reduce gently
      }

      if (quality < 65) {
        // Don't go below 65 quality to maintain good image quality
        console.log(`[v0] ⚠ Reached minimum quality (65), using best result: ${(bestSize / 1024).toFixed(2)}KB`)
        return bestCompressed
      }
    } else if (compressedSize < targetMinSize) {
      // Too small, increase quality
      const shortage = targetMinSize - compressedSize
      if (shortage > 200 * 1024) {
        quality += 5 // Large shortage, increase more
      } else {
        quality += 2 // Small shortage, increase gently
      }

      if (quality > 95) {
        // Don't go above 95 quality
        console.log(`[v0] ⚠ Reached maximum quality (95), using best result: ${(bestSize / 1024).toFixed(2)}KB`)
        return bestCompressed
      }
    }
  }

  console.log(`[v0] ✓ Compression complete! Best result: ${(bestSize / 1024).toFixed(2)}KB`)
  return bestCompressed
}

/**
 * Converts a File to Buffer for compression
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Converts a Blob to Buffer for compression
 */
export async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
