import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchPostDetailFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: NextRequest, { params }: { params: { postId: string } }) {
  try {
    console.log("[v0] API: GET request for post ID:", params.postId)
    const postId = params.postId
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      const post = await fetchPostDetailFromContabo(Number.parseInt(postId), user?.id || null)
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 })
      }
      return NextResponse.json(post)
    }

    // Fetch post with only post_likes
    const { data: post, error } = await supabase
      .from("posts")
      .select("*, post_likes(user_id)")
      .eq("id", postId)
      .single()

    if (error || !post) {
      console.error("[v0] API: Supabase error fetching post:", error)
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    console.log("[v0] API: Post fetched successfully")

    // Fetch profile separately
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url")
      .eq("id", post.user_id)
      .single()

    // Fetch post_movies separately
    const { data: postMovies } = await supabase
      .from("post_movies")
      .select("movies(id, title, poster_url, type)")
      .eq("post_id", postId)

    // Fetch hashtags separately
    const { data: postHashtagsData } = await supabase
      .from("post_hashtags")
      .select("hashtags(name)")
      .eq("post_id", postId)

    const hashtags = postHashtagsData?.map((ph: any) => ph.hashtags.name) || []

    // Build complete post object matching the PostCard interface
    const formattedPost = {
      ...post,
      profiles: profile || { id: "", username: "unknown", profile_picture_url: "" },
      post_movies: postMovies || [],
      hashtags: hashtags,
      isLiked: user ? post.post_likes?.some((like: any) => like.user_id === user.id) : false,
      post_likes: undefined, // Remove from response
    }

    console.log("[v0] API: Formatted post response ready")
    return NextResponse.json(formattedPost)
  } catch (error) {
    console.error("[v0] API: Unexpected error in post detail API:", error)
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 })
  }
}
