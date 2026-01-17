import { NextResponse } from "next/server"
import { getPublicPlayersConfig } from "@/lib/players-config"

// Public API route for players (used by watch page)
export async function GET() {
  try {
    const players = await getPublicPlayersConfig()
    return NextResponse.json({ players })
  } catch (error: any) {
    console.error("[api/players] Error:", error)
    return NextResponse.json(
      { error: "Failed to load players" },
      { status: 500 }
    )
  }
}

