import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchBlogPostFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const post = await fetchBlogPostFromContabo(slug)
      
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 })
      }

      return NextResponse.json({ post })
    }

    // Fallback to Supabase
    const supabase = await createClient()
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single()

    if (error) throw error

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return NextResponse.json({ error: "Failed to fetch blog post" }, { status: 500 })
  }
}
