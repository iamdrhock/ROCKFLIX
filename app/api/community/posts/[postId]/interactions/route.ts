import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchPostInteractionsFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      const interactions = await fetchPostInteractionsFromContabo(Number.parseInt(postId), user?.id || null)
      return NextResponse.json(interactions)
    }

    // Get post interaction counts
    const { data: post, error } = await supabase
      .from("posts")
      .select("likes_count, comments_count, repost_count")
      .eq("id", postId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let isLiked = false
    let isReposted = false

    if (user) {
      // Check if user liked this post
      const { data: likeData } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle()

      isLiked = !!likeData

      // Check if user reposted this post
      const { data: repostData } = await supabase
        .from("post_reposts")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle()

      isReposted = !!repostData
    }

    return NextResponse.json({
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      repost_count: post.repost_count || 0,
      isLiked,
      isReposted,
    })
  } catch (error) {
    console.error("Error fetching interactions:", error)
    return NextResponse.json({ error: "Failed to fetch interactions" }, { status: 500 })
  }
}
