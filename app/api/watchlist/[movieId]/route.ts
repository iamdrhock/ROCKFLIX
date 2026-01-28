import { NextResponse } from "next/server"
import { removeFromWatchlistContabo, checkWatchlistFromContabo } from "@/lib/database/contabo-writes"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export async function DELETE(request: Request, { params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId } = await params
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ error: "You must be logged in to remove from watchlist" }, { status: 401 })
    }

    // Use Contabo
    await removeFromWatchlistContabo(userId, Number.parseInt(movieId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error removing from watchlist:", error)
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId } = await params
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ inWatchlist: false })
    }

    // Use Contabo
    const inWatchlist = await checkWatchlistFromContabo(userId, Number.parseInt(movieId))
    return NextResponse.json({ inWatchlist })
  } catch (error) {
    console.error("[v0] Error checking watchlist:", error)
    return NextResponse.json({ inWatchlist: false })
  }
}

