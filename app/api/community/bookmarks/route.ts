import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { fetchBookmarksFromContabo } from "@/lib/database/contabo-queries"
import { createBookmarkInContabo, deleteBookmarkInContabo } from "@/lib/database/contabo-writes"

export async function GET() {
  try {
    // Use NextAuth session
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Use Contabo (always enabled now)
    const bookmarks = await fetchBookmarksFromContabo(userId)
    return NextResponse.json({ bookmarks })
  } catch (error) {
    console.error("[v0] Bookmarks API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Use NextAuth session
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { postId } = await request.json()

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    // Use Contabo
    try {
      const bookmark = await createBookmarkInContabo(postId, userId)
      return NextResponse.json({ bookmark })
    } catch (error: any) {
      if (error.message === 'Already bookmarked') {
        return NextResponse.json({ error: "Already bookmarked" }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error("[v0] Bookmark POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    // Use NextAuth session
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get("postId")

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    // Use Contabo
    await deleteBookmarkInContabo(Number.parseInt(postId), userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Bookmark DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

