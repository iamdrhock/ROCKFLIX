import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { put } from "@/lib/local-storage"
import { compressImage, fileToBuffer } from "@/lib/image-compression"

export const POST = adminRoute(async ({ request }) => {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const originalBuffer = await fileToBuffer(file)
    const compressedBuffer = await compressImage(originalBuffer)

    const blob = await put(`blog/${Date.now()}-${file.name}`, compressedBuffer, {
      access: "public",
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error: any) {
    console.error("[v0] Error uploading blog image:", error)
    return NextResponse.json({ error: error.message || "Failed to upload image" }, { status: 500 })
  }
})
