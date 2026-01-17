import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { put } from "@/lib/local-storage"

export const POST = adminRoute(async ({ request }) => {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const upperText = text.toUpperCase()
    const splitPoint = Math.floor(upperText.length * 0.5)
    const firstPart = upperText.slice(0, splitPoint)
    const secondPart = upperText.slice(splitPoint)

    const fontSize = 72
    const padding = 40 // Increased from 20 to 40
    const charWidth = fontSize * 0.75 // Increased from 0.6 to 0.75 for bold fonts
    const width = Math.max(400, upperText.length * charWidth + padding * 2)
    const height = fontSize + padding * 2

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#000000"/>
  <text 
    x="50%" 
    y="50%" 
    font-family="Arial Black, Arial, sans-serif" 
    font-size="${fontSize}" 
    font-weight="900" 
    text-anchor="middle" 
    dominant-baseline="middle"
    letter-spacing="1"
  >
    <tspan fill="#BFFF00">${firstPart}</tspan><tspan fill="#FFFFFF">${secondPart}</tspan>
  </text>
</svg>`

    const blob = new Blob([svg], { type: "image/svg+xml" })
    const buffer = Buffer.from(await blob.arrayBuffer())
    const filename = `images/logo-${Date.now()}.svg`

    const { url } = await put(filename, buffer, {
      access: "public",
      contentType: "image/svg+xml",
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error("[v0] Error generating logo:", error)
    return NextResponse.json({ error: "Failed to generate logo" }, { status: 500 })
  }
})
