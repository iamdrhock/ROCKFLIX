import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchBlogPostsFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const result = await fetchBlogPostsFromContabo(page, limit)
      return NextResponse.json({
        posts: result.posts,
        total: result.total,
        page,
        totalPages: result.totalPages,
      })
    }

    // Fallback to Supabase
    const supabase = await createClient()
    const offset = (page - 1) * limit

    const {
      data: posts,
      error,
      count,
    } = await supabase
      .from("blog_posts")
      .select("*", { count: "exact" })
      .eq("published", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return NextResponse.json({ error: "Failed to fetch blog posts" }, { status: 500 })
  }
}
