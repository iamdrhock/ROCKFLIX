import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchQuoteDetailFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: NextRequest, { params }: { params: Promise<{ repostId: string }> }) {
  try {
    const { repostId } = await params
    console.log("[v0] API: GET request for quote ID:", repostId)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      const quote = await fetchQuoteDetailFromContabo(Number.parseInt(repostId), user?.id || null)
      if (!quote) {
        return NextResponse.json({ error: "Quote not found" }, { status: 404 })
      }
      return NextResponse.json(quote)
    }

    // Fetch the repost/quote
    const { data: repost, error: repostError } = await supabase
      .from("post_reposts")
      .select("*")
      .eq("id", repostId)
      .single()

    if (repostError || !repost) {
      console.error("[v0] API: Quote not found:", repostError)
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Fetch reposter profile
    const { data: reposterProfile } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url")
      .eq("id", repost.user_id)
      .single()

    // Fetch original post
    const { data: originalPost } = await supabase.from("posts").select("*").eq("id", repost.post_id).single()

    if (!originalPost) {
      return NextResponse.json({ error: "Original post not found" }, { status: 404 })
    }

    // Fetch original post author profile
    const { data: originalProfile } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url")
      .eq("id", originalPost.user_id)
      .single()

    // Fetch post movies for original post
    const { data: postMovies } = await supabase
      .from("post_movies")
      .select("movies(id, title, poster_url, type)")
      .eq("post_id", originalPost.id)

    // Format the quote post
    const formattedQuote = {
      id: repost.post_id.toString(),
      repost_id: repost.id,
      quote_content: repost.quote_content,
      created_at: repost.created_at,
      profiles: reposterProfile || { id: "", username: "unknown", profile_picture_url: "" },
      original_post: {
        ...originalPost,
        profiles: originalProfile || { id: "", username: "unknown", profile_picture_url: "" },
        post_movies: postMovies || [],
      },
      type: "quote",
    }

    console.log("[v0] API: Quote fetched successfully")
    return NextResponse.json(formattedQuote)
  } catch (error) {
    console.error("[v0] API: Unexpected error in quote detail API:", error)
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 })
  }
}
