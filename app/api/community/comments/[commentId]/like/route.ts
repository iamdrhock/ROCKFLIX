import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { toggleCommentLikeInContabo } from "@/lib/database/contabo-writes"
import { getCommentReactionFromContabo } from "@/lib/database/contabo-queries"

export async function POST(request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const { commentId } = await params
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { isLike } = body // true for like, false for dislike

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      const result = await toggleCommentLikeInContabo(Number.parseInt(commentId), user.id, isLike)
      return NextResponse.json({ success: true, action: result.action })
    }

    // Check if user already reacted to this comment
    const { data: existing } = await supabase
      .from("comment_likes")
      .select("*")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .single()

    if (existing) {
      if (existing.is_like === isLike) {
        // Same reaction - remove it (toggle off)
        const { error: deleteError } = await supabase.from("comment_likes").delete().eq("id", existing.id)

        if (deleteError) throw deleteError
        return NextResponse.json({ success: true, action: "removed" })
      } else {
        // Different reaction - update it
        const { error: updateError } = await supabase
          .from("comment_likes")
          .update({ is_like: isLike })
          .eq("id", existing.id)

        if (updateError) throw updateError
        return NextResponse.json({ success: true, action: "updated" })
      }
    } else {
      // No existing reaction - create new one
      const { error: insertError } = await supabase
        .from("comment_likes")
        .insert({ comment_id: commentId, user_id: user.id, is_like: isLike })

      if (insertError) throw insertError
      return NextResponse.json({ success: true, action: "added" })
    }
  } catch (error) {
    console.error("[v0] Error in comment like API:", error)
    return NextResponse.json({ error: "Failed to process reaction" }, { status: 500 })
  }
}

// Get user's reaction status for a comment
export async function GET(request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const { commentId } = await params
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ userReaction: null })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      const reaction = await getCommentReactionFromContabo(Number.parseInt(commentId), user.id)
      return NextResponse.json({ userReaction: reaction })
    }

    const { data } = await supabase
      .from("comment_likes")
      .select("is_like")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({
      userReaction: data ? (data.is_like ? "like" : "dislike") : null,
    })
  } catch (error) {
    console.error("[v0] Error fetching comment reaction:", error)
    return NextResponse.json({ userReaction: null })
  }
}
