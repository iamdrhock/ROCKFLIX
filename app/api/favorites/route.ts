import { NextResponse } from "next/server"
import { getFavoritesFromContabo, addFavoriteToContabo } from "@/lib/database/contabo-writes"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    let targetUserId = userId

    if (!targetUserId) {
      // If no userId provided, use logged-in user
      const session = await getAuthSession()

      const userId = (session?.user as { id?: string | null } | null)?.id || null
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      targetUserId = userId
    }

    // Use Contabo
    const favorites = await getFavoritesFromContabo(targetUserId)
    return NextResponse.json({ favorites })
  } catch (error) {
    console.error("Error fetching favorites:", error)
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { movieId } = await request.json()

    // Use Contabo
    await addFavoriteToContabo(userId, Number.parseInt(movieId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding to favorites:", error)
    return NextResponse.json({ error: "Failed to add to favorites" }, { status: 500 })
  }
}

