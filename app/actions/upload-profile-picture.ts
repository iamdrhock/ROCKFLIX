"use server"

import { put } from "@/lib/local-storage"
import { compressImage, fileToBuffer } from "@/lib/image-compression"

export async function uploadProfilePicture(formData: FormData) {
  try {
    const file = formData.get("file") as File
    const userId = formData.get("userId") as string

    if (!file) {
      return { error: "No file provided" }
    }

    const originalBuffer = await fileToBuffer(file)
    const compressedBuffer = await compressImage(originalBuffer)

    const blob = await put(`profile-pictures/${userId}-${Date.now()}.${file.name.split(".").pop()}`, compressedBuffer, {
      access: "public",
      contentType: file.type,
    })

    return { url: blob.url }
  } catch (error) {
    console.error("[v0] Error uploading profile picture:", error)
    return { error: "Failed to upload profile picture" }
  }
}
