import { adminRoute } from "@/lib/security/admin-middleware"
import { sanitizeAdminHtml } from "@/lib/security/sanitize"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

function getIdFromParams(params?: Record<string, string | string[]>) {
  const raw = params?.id
  return Array.isArray(raw) ? raw[0] : raw
}

async function resolveId(
  routeContext: { params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> } | undefined,
  request: Request,
) {
  // Handle Next.js 15 async params
  let params: Record<string, string | string[]> | undefined
  if (routeContext?.params) {
    params = routeContext.params instanceof Promise 
      ? await routeContext.params 
      : routeContext.params
  }
  
  const fromParams = getIdFromParams(params)
  if (fromParams) return fromParams

  try {
    const url = new URL(request.url)
    const searchId = url.searchParams.get("id")
    if (searchId) {
      return searchId
    }

    const parts = url.pathname.split("/").filter(Boolean)
    const last = parts.pop() || null
    if (!last) return null
    const sanitized = last.split("?")[0].split("#")[0]
    return sanitized || null
  } catch {
    return null
  }
}

export const GET = adminRoute(async ({ supabase, request }, routeContext) => {
  try {
    const id = await resolveId(routeContext, request)
    if (!id) {
      console.warn("[admin/blog/:id] Missing id", {
        url: request.url,
        params: routeContext?.params,
      })
    }
    if (!id) {
      return jsonResponse({ error: "Missing blog post id" }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const postId = Number.parseInt(id)
        
        console.log("[admin/blog/:id] 🔍 GET - Fetching post from Contabo with id:", postId)
        
        const result = await queryContabo<any>('SELECT * FROM blog_posts WHERE id = $1', [postId])
        
        if (!result || !result.rows || result.rows.length === 0) {
          console.log("[admin/blog/:id] ❌ GET - Post not found in Contabo with id:", postId)
          return jsonResponse({ error: "Blog post not found" }, 404)
        }
        
        const post = result.rows[0]
        console.log("[admin/blog/:id] ✅ GET - Found post in Contabo:", {
          id: post.id,
          title: post.title,
          slug: post.slug,
          bodyLength: post.body?.length,
          published: post.published
        })
        
        return jsonResponse({ post })
      } catch (contaboError: any) {
        console.error("[admin/blog/:id] ❌ GET - Contabo error:", contaboError)
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/blog/:id] GET - Falling back to Supabase")
        } else {
          return jsonResponse({ 
            error: contaboError.message || "Failed to fetch blog post" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    const { data: post, error } = await supabase.from("blog_posts").select("*").eq("id", id).single()

    if (error) throw error

    return jsonResponse({ post })
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return jsonResponse({ error: "Failed to fetch blog post" }, 500)
  }
})

export const PATCH = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    console.log("[admin/blog/:id] 🚀 PATCH request received:", {
      url: request.url,
      method: request.method,
      hasRouteContext: !!routeContext
    })
    
    const id = await resolveId(routeContext, request)
    console.log("[admin/blog/:id] 📍 Resolved ID:", id)
    
    if (!id) {
      console.warn("[admin/blog/:id] ❌ Missing id on PATCH", {
        url: request.url,
        params: routeContext?.params,
      })
      return jsonResponse({ error: "Missing blog post id" }, 400)
    }

    const body = await request.json()
    console.log("[admin/blog/:id] 📦 Request body received:", {
      hasTitle: !!body.title,
      hasSlug: !!body.slug,
      hasBody: !!body.body,
      bodyLength: body.body?.length,
      hasFeaturedImage: !!body.featured_image_url,
      published: body.published
    })
    
    const { title, slug, body: content, featured_image_url, published } = body

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[admin/blog/:id] 🗄️ Using Contabo database")
      try {
        const { updateBlogPostInContabo } = await import('@/lib/database/contabo-writes')
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        const postId = Number.parseInt(id)
        console.log("[admin/blog/:id] 🔍 Fetching existing post with id:", postId)
        
        // Fetch existing post to get current values for fields not being updated
        const existing = await queryContabo<any>('SELECT * FROM blog_posts WHERE id = $1', [postId])
        
        console.log("[admin/blog/:id] 📊 Existing post query result:", {
          hasResult: !!existing,
          hasRows: !!existing?.rows,
          rowCount: existing?.rows?.length
        })
        
        if (!existing || !existing.rows || existing.rows.length === 0) {
          console.error("[admin/blog/:id] ❌ Blog post not found with id:", postId)
          return jsonResponse({ error: "Blog post not found" }, 404)
        }
        
        const current = existing.rows[0]
        console.log("[admin/blog/:id] 📄 Current post data:", {
          id: current.id,
          title: current.title,
          slug: current.slug,
          bodyLength: current.body?.length,
          published: current.published
        })
        
        // Build update data - always include all fields to ensure they're saved
        const updateTitle = title ?? current.title
        const updateSlug = slug ?? current.slug
        const updateBody = content !== undefined ? sanitizeAdminHtml(content) : current.body
        const updateFeaturedImage = featured_image_url !== undefined ? featured_image_url : current.featured_image_url
        const updatePublished = published !== undefined ? published : current.published
        
        console.log("[admin/blog/:id] 🔄 Prepared update data:", {
          id: postId,
          title: updateTitle,
          slug: updateSlug,
          bodyLength: typeof updateBody === 'string' ? updateBody.length : 'unknown',
          featuredImage: updateFeaturedImage,
          published: updatePublished,
          titleChanged: updateTitle !== current.title,
          slugChanged: updateSlug !== current.slug,
          bodyChanged: updateBody !== current.body
        })
        
        console.log("[admin/blog/:id] 💾 Calling updateBlogPostInContabo...")
        const post = await updateBlogPostInContabo(
          postId,
          updateTitle,
          updateSlug,
          updateBody,
          updateFeaturedImage,
          updatePublished
        )
        
        console.log("[admin/blog/:id] 📥 Update function returned:", {
          hasPost: !!post,
          postId: post?.id,
          postTitle: post?.title,
          postSlug: post?.slug
        })
        
        if (!post || !post.id) {
          console.error("[admin/blog/:id] ❌ Update function returned invalid data:", post)
          throw new Error("Failed to update blog post - no valid data returned from update function")
        }
        
        // Verify the update actually worked by fetching again
        console.log("[admin/blog/:id] ✅ Verifying update by fetching post again...")
        const verify = await queryContabo<any>('SELECT * FROM blog_posts WHERE id = $1', [postId])
        if (verify?.rows?.[0]) {
          const saved = verify.rows[0]
          console.log("[admin/blog/:id] ✅ Verification - saved data:", {
            id: saved.id,
            title: saved.title,
            slug: saved.slug,
            bodyLength: saved.body?.length,
            published: saved.published,
            updatedAt: saved.updated_at,
            matchesTitle: saved.title === updateTitle,
            matchesSlug: saved.slug === updateSlug
          })
        } else {
          console.error("[admin/blog/:id] ❌ Verification failed - post not found after update!")
        }
        
        console.log("[admin/blog/:id] ✅ Successfully updated blog post:", postId, "Returned post:", { id: post.id, title: post.title })
        return jsonResponse({ post })
      } catch (contaboError: any) {
        console.error("[admin/blog/:id] Contabo error:", contaboError)
        if (contaboError.code === "23505" || contaboError.message?.includes("duplicate")) {
          return jsonResponse({ error: "A post with this slug already exists" }, 400)
        }
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/blog/:id] Falling back to Supabase")
        } else {
          // If Contabo is the only DB and it failed, return error
          return jsonResponse({ 
            error: contaboError.message || "Failed to update blog post" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (slug !== undefined) updateData.slug = slug
    if (content !== undefined) updateData.body = sanitizeAdminHtml(content)
    if (featured_image_url !== undefined) updateData.featured_image_url = featured_image_url
    if (published !== undefined) updateData.published = published

    const { data: post, error } = await supabase
      .from("blog_posts")
      .update(updateData)
      .eq("id", id)
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
    console.error("Error updating blog post:", error)
    return jsonResponse({ error: "Failed to update blog post" }, 500)
  }
})

export const DELETE = adminRoute(async ({ supabase, request }, routeContext) => {
  try {
    const id = await resolveId(routeContext, request)
    if (!id) {
      console.warn("[admin/blog/:id] Missing id on DELETE", {
        url: request.url,
        params: routeContext?.params,
      })
      return jsonResponse({ error: "Missing blog post id" }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const postId = Number.parseInt(id)
        
        console.log("[admin/blog/:id] 🗑️ DELETE - Deleting post from Contabo with id:", postId)
        
        const result = await queryContabo('DELETE FROM blog_posts WHERE id = $1 RETURNING id', [postId])
        
        if (!result.rowCount || result.rowCount === 0) {
          console.log("[admin/blog/:id] ❌ DELETE - Post not found in Contabo with id:", postId)
          return jsonResponse({ error: "Blog post not found" }, 404)
        }
        
        console.log("[admin/blog/:id] ✅ DELETE - Successfully deleted post from Contabo:", postId)
        return jsonResponse({ success: true })
      } catch (contaboError: any) {
        console.error("[admin/blog/:id] ❌ DELETE - Contabo error:", contaboError)
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/blog/:id] DELETE - Falling back to Supabase")
        } else {
          return jsonResponse({ 
            error: contaboError.message || "Failed to delete blog post" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    const { error } = await supabase.from("blog_posts").delete().eq("id", id)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (error) {
    console.error("Error deleting blog post:", error)
    return jsonResponse({ error: "Failed to delete blog post" }, 500)
  }
})
