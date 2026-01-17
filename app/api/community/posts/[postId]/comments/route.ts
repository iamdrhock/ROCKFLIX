import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { sanitizeHtml } from "@/lib/security/validation"
import { fetchPostCommentsFromContabo } from "@/lib/database/contabo-queries"
import { createPostCommentInContabo } from "@/lib/database/contabo-writes"

export async function GET(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const comments = await fetchPostCommentsFromContabo(Number.parseInt(postId), user?.id || null)
      return NextResponse.json({ comments })
    }

    // Fetch all comments for the post
    const { data: comments, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching comments:", error)
      throw error
    }

    // Fetch user profiles for all comments
    const userIds = [...new Set(comments?.map((c) => c.user_id) || [])]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url")
      .in("id", userIds)

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

    let userReactions: Record<number, string> = {}

    if (user && comments && comments.length > 0) {
      const commentIds = comments.map((c) => c.id)
      const { data: reactions } = await supabase
        .from("comment_likes")
        .select("comment_id, is_like")
        .eq("user_id", user.id)
        .in("comment_id", commentIds)

      userReactions =
        reactions?.reduce(
          (acc, r) => ({
            ...acc,
            [r.comment_id]: r.is_like ? "like" : "dislike",
          }),
          {},
        ) || {}
    }

    // Build threaded structure
    const commentsWithProfiles = comments?.map((comment) => ({
      ...comment,
      profiles: profileMap.get(comment.user_id),
      userReaction: userReactions[comment.id] || null,
      engagementScore: (comment.likes_count || 0) - (comment.dislikes_count || 0),
    }))

    // Organize into threads (top-level comments and replies)
    const topLevelComments = commentsWithProfiles?.filter((c) => !c.parent_comment_id) || []
    const repliesMap = new Map()

    commentsWithProfiles?.forEach((comment) => {
      if (comment.parent_comment_id) {
        if (!repliesMap.has(comment.parent_comment_id)) {
          repliesMap.set(comment.parent_comment_id, [])
        }
        repliesMap.get(comment.parent_comment_id).push(comment)
      }
    })

    const threaded = topLevelComments.map((comment) => {
      const replies = repliesMap.get(comment.id) || []
      const sortedReplies = replies.sort((a, b) => b.engagementScore - a.engagementScore)
      return {
        ...comment,
        replies: sortedReplies,
      }
    })

    const sortedThreaded = threaded.sort((a, b) => b.engagementScore - a.engagementScore)

    return NextResponse.json({ comments: sortedThreaded })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, parent_comment_id } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(content.trim())
    
    if (!sanitizedContent || sanitizedContent.length === 0) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 })
    }

    // Limit comment length
    if (sanitizedContent.length > 1000) {
      return NextResponse.json({ error: "Comment must be 1000 characters or less" }, { status: 400 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const comment = await createPostCommentInContabo({
        postId: Number.parseInt(postId),
        userId: user.id,
        content: sanitizedContent,
        parentCommentId: parent_comment_id || null,
      })
      return NextResponse.json({ comment })
    }

    // Fallback to Supabase
    const { data: comment, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: Number.parseInt(postId),
        user_id: user.id,
        content: sanitizedContent,
        parent_comment_id,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating comment:", error)
      throw error
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url")
      .eq("id", user.id)
      .single()

    const commentWithProfile = {
      ...comment,
      profiles: profile,
      replies: [],
    }

    return NextResponse.json({ comment: commentWithProfile })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
