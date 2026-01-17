import { NextResponse } from "next/server"
import { getWatchlistFromContabo, addToWatchlistContabo } from "@/lib/database/contabo-writes"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export async function GET() {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be logged in to view your watchlist" }, { status: 401 })
    }

    // Use Contabo
    const watchlist = await getWatchlistFromContabo(session.user.id)
    return NextResponse.json(watchlist)
  } catch (error) {
    console.error("[v0] Error fetching watchlist:", error)
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be logged in to add to watchlist" }, { status: 401 })
    }

    const body = await request.json()
    const { movie_id } = body

    if (!movie_id) {
      return NextResponse.json({ error: "Movie ID is required" }, { status: 400 })
    }

    // Use Contabo
    try {
      const data = await addToWatchlistContabo(session.user.id, Number.parseInt(movie_id))
      return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
      // Check if it's a duplicate entry error
      if (error.code === "23505" || error.message?.includes("duplicate")) {
        return NextResponse.json({ error: "This item is already in your watchlist" }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    console.error("[v0] Error adding to watchlist:", error)
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 })
  }
}

