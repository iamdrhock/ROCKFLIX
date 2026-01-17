import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { sanitizeSearchQuery } from "@/lib/security/validation"
import { searchCommunityFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q") || ""

    if (!rawQuery.trim()) {
      return NextResponse.json({ posts: [], users: [], hashtags: [] })
    }

    // Sanitize search query to prevent injection attacks
    const query = sanitizeSearchQuery(rawQuery)
    
    if (!query || query.length === 0) {
      return NextResponse.json({ posts: [], users: [], hashtags: [] })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[v0] Using Contabo for community search")
      const result = await searchCommunityFromContabo(query, user?.id || null)
      return NextResponse.json(result)
    }

    const searchTerm = `%${query.toLowerCase()}%`

    // Search posts
    const { data: posts } = await supabase
      .from("posts")
      .select("*, profiles(id, username, profile_picture_url)")
      .ilike("content", searchTerm)
      .order("created_at", { ascending: false })
      .limit(20)

    // Search users
    const { data: users } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url, about")
      .or(`username.ilike.${searchTerm},about.ilike.${searchTerm}`)
      .limit(20)

    // Search hashtags
    const { data: hashtags } = await supabase
      .from("hashtags")
      .select("*")
      .ilike("name", searchTerm)
      .order("post_count", { ascending: false })
      .limit(20)

    // Add like status to posts
    const postsWithLikes = await Promise.all(
      (posts || []).map(async (post) => {
        if (user) {
          const { data: likeData } = await supabase
            .from("post_likes")
            .select("id")
            .eq("post_id", post.id)
            .eq("user_id", user.id)
            .single()

          return {
            ...post,
            isLiked: !!likeData,
          }
        }
        return {
          ...post,
          isLiked: false,
        }
      }),
    )

    return NextResponse.json({
      posts: postsWithLikes,
      users: users || [],
      hashtags: hashtags || [],
    })
  } catch (error) {
    console.error("Error searching:", error)
    return NextResponse.json({ error: "Failed to search" }, { status: 500 })
  }
}
