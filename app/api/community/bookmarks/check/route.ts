import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { checkBookmarkStatusInContabo } from "@/lib/database/contabo-writes"

export async function GET(request: Request) {
  try {
    // Use NextAuth session
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ isBookmarked: false })
    }

    const { searchParams } = new URL(request.url)
    const postId = searchParams.get("postId")

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    // Use Contabo
    const isBookmarked = await checkBookmarkStatusInContabo(Number.parseInt(postId), userId)
    return NextResponse.json({ isBookmarked })
  } catch (error) {
    console.error("[v0] Bookmark check error:", error)
    return NextResponse.json({ isBookmarked: false })
  }
}

