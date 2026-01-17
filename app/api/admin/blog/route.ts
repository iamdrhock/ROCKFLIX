import { adminRoute } from "@/lib/security/admin-middleware"
import { sanitizeAdminHtml } from "@/lib/security/sanitize"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const GET = adminRoute(async ({ request, supabase }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const limitParam = searchParams.get("limit")
    // Enforce maximum limit to prevent resource exhaustion
    const limit = Math.min(limitParam ? Number.parseInt(limitParam, 10) : 50, 200)

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        console.log("[admin/blog] 🔍 GET - Fetching blog posts from Contabo:", { search, limit })
        
        let sql = 'SELECT * FROM blog_posts'
        const params: any[] = []
        let paramIndex = 1
        
        // Add search filter if provided
        if (search) {
          sql += ` WHERE (title ILIKE $${paramIndex} OR body ILIKE $${paramIndex})`
          params.push(`%${search}%`)
          paramIndex++
        }
        
        sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
        params.push(limit)
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM blog_posts'
        const countParams: any[] = []
        let countParamIndex = 1
        
        if (search) {
          countSql += ` WHERE (title ILIKE $${countParamIndex} OR body ILIKE $${countParamIndex})`
          countParams.push(`%${search}%`)
          countParamIndex++
        }
        
        const [result, countResult] = await Promise.all([
          queryContabo<any>(sql, params),
          queryContabo<{ total: number }>(countSql, countParams)
        ])
        
        const posts = result.rows || []
        const total = countResult.rows[0]?.total || 0
        
        console.log("[admin/blog] ✅ GET - Found posts in Contabo:", {
          count: posts.length,
          total,
          search: search || 'none'
        })
        
        return jsonResponse({
          posts,
          total,
          limit,
          _note: limit >= 200 ? "Maximum limit reached. Use pagination for more results." : undefined,
        })
      } catch (contaboError: any) {
        console.error("[admin/blog] ❌ GET - Contabo error:", contaboError)
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/blog] GET - Falling back to Supabase")
        } else {
          return jsonResponse({ 
            error: contaboError.message || "Failed to fetch blog posts" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    let query = supabase.from("blog_posts").select("*", { count: "exact" })

    if (search) {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
    }

    const { data: posts, error, count } = await query.order("created_at", { ascending: false }).limit(limit)

    if (error) throw error

    return jsonResponse({
      posts: posts || [],
      total: count || 0,
      limit,
      _note: limit >= 200 ? "Maximum limit reached. Use pagination for more results." : undefined,
    })
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return jsonResponse({ error: "Failed to fetch blog posts" }, 500)
  }
})

export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    const body = await request.json()
    const { title, slug, body: content, featured_image_url, published } = body

    if (!title || !slug || !content) {
      return jsonResponse({ error: "Title, slug, and body are required" }, 400)
    }

    const sanitizedBody = sanitizeAdminHtml(content)

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { addBlogPostToContabo } = await import('@/lib/database/contabo-writes')
        const post = await addBlogPostToContabo(
          title,
          slug,
          sanitizedBody,
          featured_image_url,
          published || false
        )
        
        if (!post) {
          throw new Error("Failed to create blog post - no data returned")
        }
        
        console.log("[admin/blog] Successfully created blog post:", post.id)
        return jsonResponse({ post })
      } catch (contaboError: any) {
        console.error("[admin/blog] Contabo error:", contaboError)
        if (contaboError.code === "23505" || contaboError.message?.includes("duplicate")) {
          return jsonResponse({ error: "A post with this slug already exists" }, 400)
        }
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/blog] Falling back to Supabase")
        } else {
          // If Contabo is the only DB and it failed, return error
          return jsonResponse({ 
            error: contaboError.message || "Failed to create blog post" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    const { data: post, error } = await supabase
      .from("blog_posts")
      .insert({
        title,
        slug,
        body: sanitizedBody,
        featured_image_url,
        published: published || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({ error: "A post with this slug already exists" }, 400)
      }
      throw error
    }

    return jsonResponse({ post })
  } catch (error) {
    console.error("Error creating blog post:", error)
    return jsonResponse({ error: "Failed to create blog post" }, 500)
  }
})
