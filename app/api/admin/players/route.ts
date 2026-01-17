import { adminRoute } from "@/lib/security/admin-middleware"
import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const PLAYERS_CONFIG_PATH = path.join(process.cwd(), "data", "players.json")

// Default player definitions
const DEFAULT_PLAYERS = [
  { id: "vidify", name: "Vidify", url: "https://player.vidify.top/embed" },
  { id: "vidplus", name: "Vidplus", url: "https://player.vidplus.to/embed" },
  { id: "vidsrc", name: "VidSrc", url: "https://vidsrc-embed.ru" },
  { id: "vidlink", name: "VidLink", url: "https://vidlink.pro" },
  { id: "mapple", name: "Mapple", url: "https://mapple.uk/watch" },
  { id: "primesrc", name: "PrimeSrc", url: "https://primesrc.me/embed" },
  { id: "superembed", name: "SuperEmbed", url: process.env.NEXT_PUBLIC_EMBED_SUPEREMBED || "https://multiembed.mov/directstream.php" },
  { id: "autoembed", name: "AutoEmbed", url: "https://player.autoembed.cc/embed" },
  { id: "videasy", name: "Videasy", url: "https://player.videasy.net" },
]

// GET - Fetch current player order
export const GET = adminRoute(async () => {
  try {
    let playerOrder: string[] = []
    
    try {
      const fileContent = await fs.readFile(PLAYERS_CONFIG_PATH, "utf-8")
      playerOrder = JSON.parse(fileContent)
      
      if (!Array.isArray(playerOrder)) {
        throw new Error("Invalid config format")
      }
    } catch (error) {
      console.log("[admin/players] Config file not found or invalid, using default order")
      // Return default order if file doesn't exist
      playerOrder = DEFAULT_PLAYERS.map(p => p.id)
    }

    // Build full player objects with order
    const players = playerOrder.map((playerId, index) => {
      const playerDef = DEFAULT_PLAYERS.find(p => p.id === playerId)
      if (!playerDef) {
        return null
      }
      return {
        id: playerDef.id,
        name: playerDef.name,
        url: playerDef.url,
        order: index + 1,
        displayName: `PLAYER ${String(index + 1).padStart(2, "0")}`,
      }
    }).filter(Boolean)

    // Add any missing players at the end
    DEFAULT_PLAYERS.forEach(playerDef => {
      if (!playerOrder.includes(playerDef.id)) {
        players.push({
          id: playerDef.id,
          name: playerDef.name,
          url: playerDef.url,
          order: players.length + 1,
          displayName: `PLAYER ${String(players.length + 1).padStart(2, "0")}`,
        })
      }
    })

    return NextResponse.json({ players, order: playerOrder })
  } catch (error: any) {
    console.error("[admin/players] GET error:", error)
    return NextResponse.json(
      { error: "Failed to load player configuration" },
      { status: 500 }
    )
  }
})

// PUT - Update player order
export const PUT = adminRoute(async ({ request }) => {
  try {
    const body = await request.json()
    const { order } = body

    if (!Array.isArray(order)) {
      return NextResponse.json(
        { error: "Invalid request: order must be an array" },
        { status: 400 }
      )
    }

    // Validate all player IDs exist
    const validPlayerIds = DEFAULT_PLAYERS.map(p => p.id)
    const invalidIds = order.filter((id: string) => !validPlayerIds.includes(id))
    
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid player IDs: ${invalidIds.join(", ")}` },
        { status: 400 }
      )
    }

    // Ensure all players are included
    const missingIds = validPlayerIds.filter(id => !order.includes(id))
    if (missingIds.length > 0) {
      // Add missing players at the end
      order.push(...missingIds)
    }

    // Ensure directory exists
    const configDir = path.dirname(PLAYERS_CONFIG_PATH)
    await fs.mkdir(configDir, { recursive: true })

    // Write new order to file
    await fs.writeFile(PLAYERS_CONFIG_PATH, JSON.stringify(order, null, 2), "utf-8")

    console.log("[admin/players] Player order updated:", order)

    return NextResponse.json({ success: true, order })
  } catch (error: any) {
    console.error("[admin/players] PUT error:", error)
    return NextResponse.json(
      { error: "Failed to update player configuration" },
      { status: 500 }
    )
  }
})

