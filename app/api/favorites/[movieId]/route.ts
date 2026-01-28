import { NextResponse } from "next/server"
import { checkFavoriteFromContabo, removeFavoriteFromContabo } from "@/lib/database/contabo-writes"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export async function GET(request: Request, { params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId } = await params
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ isFavorite: false })
    }

    // Use Contabo
    const isFavorite = await checkFavoriteFromContabo(userId, Number.parseInt(movieId))
    return NextResponse.json({ isFavorite })
  } catch (error) {
    console.error("Error checking favorite status:", error)
    return NextResponse.json({ isFavorite: false })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId } = await params
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use Contabo
    await removeFavoriteFromContabo(userId, Number.parseInt(movieId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing from favorites:", error)
    return NextResponse.json({ error: "Failed to remove from favorites" }, { status: 500 })
  }
}

