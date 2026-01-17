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
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 200) // Max 200 per page

    let query = supabase
      .from("custom_pages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return jsonResponse({
      pages: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching custom pages:", error)
    return jsonResponse({ error: "Failed to fetch custom pages" }, 500)
  }
})

export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    const body = await request.json()
    const { title, slug, content, featured_image_url, published } = body

    // Validate required fields
    if (!title || !slug || !content) {
      return jsonResponse({ error: "Title, slug, and content are required" }, 400)
    }

    // Reserved slugs that cannot be used
    const reservedSlugs = ["movies", "tv-shows", "genres", "blog", "admin", "api", "watch", "search"]

    if (reservedSlugs.includes(slug.toLowerCase())) {
      return jsonResponse({ error: `The slug "${slug}" is reserved and cannot be used` }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { addCustomPageToContabo } = await import('@/lib/database/contabo-writes')
        const page = await addCustomPageToContabo(
          title,
          slug,
          sanitizeAdminHtml(content),
          featured_image_url,
          published || false
        )
        
        if (!page) {
          throw new Error("Failed to create page - no data returned")
        }
        
        console.log("[admin/pages] Successfully created page:", page.id)
        return jsonResponse({ page }, 201)
      } catch (contaboError: any) {
        console.error("[admin/pages] Contabo error:", contaboError)
        if (contaboError.code === "23505" || contaboError.message?.includes("duplicate")) {
          return jsonResponse({ error: "A page with this slug already exists" }, 400)
        }
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/pages] Falling back to Supabase")
        } else {
          // If Contabo is the only DB and it failed, return error
          return jsonResponse({ 
            error: contaboError.message || "Failed to create page" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from("custom_pages")
      .insert({
        title,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        content: sanitizeAdminHtml(content),
        featured_image_url: featured_image_url || null,
        published: published || false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return jsonResponse({ error: "A page with this slug already exists" }, 400)
      }
      throw error
    }

    return jsonResponse({ page: data }, 201)
  } catch (error) {
    console.error("Error creating custom page:", error)
    return jsonResponse({ error: "Failed to create custom page" }, 500)
  }
})
