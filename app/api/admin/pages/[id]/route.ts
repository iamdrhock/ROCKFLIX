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
    if (searchId) return searchId

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
      console.warn("[admin/pages/:id] Missing id", {
        url: request.url,
        params: routeContext?.params,
      })
    }
    if (!id) {
      return jsonResponse({ error: "Missing page id" }, 400)
    }

    const { data, error } = await supabase.from("custom_pages").select("*").eq("id", id).single()

    if (error) throw error

    return jsonResponse({ page: data })
  } catch (error) {
    console.error("Error fetching custom page:", error)
    return jsonResponse({ error: "Failed to fetch custom page" }, 500)
  }
})

export const PATCH = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const id = await resolveId(routeContext, request)
    if (!id) {
      console.warn("[admin/pages/:id] Missing id on PATCH", {
        url: request.url,
        params: routeContext?.params,
      })
      return jsonResponse({ error: "Missing page id" }, 400)
    }

    const body = await request.json()
    const { title, slug, content, featured_image_url, published } = body

    // Reserved slugs that cannot be used
    const reservedSlugs = ["movies", "tv-shows", "genres", "blog", "admin", "api", "watch", "search"]

    if (slug && reservedSlugs.includes(slug.toLowerCase())) {
      return jsonResponse({ error: `The slug "${slug}" is reserved and cannot be used` }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { updateCustomPageInContabo } = await import('@/lib/database/contabo-writes')
        // Need to fetch existing page first to get current values for fields not being updated
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const existing = await queryContabo<any>('SELECT * FROM custom_pages WHERE id = $1', [Number.parseInt(id)])
        
        if (!existing || existing.rows.length === 0) {
          console.error("[admin/pages/:id] Page not found with id:", id)
          return jsonResponse({ error: "Page not found" }, 404)
        }
        
        const current = existing.rows[0]
        
        // Build update data - always include all fields to ensure they're saved
        const updateTitle = title !== undefined ? title : current.title
        const updateSlug = slug !== undefined ? slug : current.slug
        const updateContent = content !== undefined ? sanitizeAdminHtml(content) : current.content
        const updateFeaturedImage = featured_image_url !== undefined ? featured_image_url : current.featured_image_url
        const updatePublished = published !== undefined ? published : current.published
        
        console.log("[admin/pages/:id] Updating page:", {
          id,
          title: updateTitle,
          slug: updateSlug,
          contentLength: updateContent.length,
          featuredImage: updateFeaturedImage,
          published: updatePublished
        })
        
        const page = await updateCustomPageInContabo(
          Number.parseInt(id),
          updateTitle,
          updateSlug,
          updateContent,
          updateFeaturedImage,
          updatePublished
        )
        
        if (!page) {
          console.error("[admin/pages/:id] Update function returned null/undefined")
          throw new Error("Failed to update page - no data returned from update function")
        }
        
        console.log("[admin/pages/:id] Successfully updated page:", id, "Returned page:", { id: page.id, title: page.title })
        return jsonResponse({ page })
      } catch (contaboError: any) {
        console.error("[admin/pages/:id] Contabo error:", contaboError)
        if (contaboError.code === "23505" || contaboError.message?.includes("duplicate")) {
          return jsonResponse({ error: "A page with this slug already exists" }, 400)
        }
        // Only fall through to Supabase if it's enabled
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.log("[admin/pages/:id] Falling back to Supabase")
        } else {
          // If Contabo is the only DB and it failed, return error
          return jsonResponse({ 
            error: contaboError.message || "Failed to update page" 
          }, 500)
        }
      }
    }

    // Fallback to Supabase
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (slug !== undefined) updateData.slug = slug.toLowerCase().replace(/\s+/g, "-")
    if (content !== undefined) {
      const sanitized = sanitizeAdminHtml(content)
      console.log("[admin/pages] Sanitizing content:", {
        originalLength: content.length,
        sanitizedLength: sanitized.length,
        hasIframe: content.includes("<iframe"),
        sanitizedHasIframe: sanitized.includes("<iframe"),
      })
      updateData.content = sanitized
    }
    if (featured_image_url !== undefined) updateData.featured_image_url = featured_image_url
    if (published !== undefined) updateData.published = published

    const { data, error } = await supabase.from("custom_pages").update(updateData).eq("id", id).select().single()

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({ error: "A page with this slug already exists" }, 400)
      }
      throw error
    }

    return jsonResponse({ page: data })
  } catch (error) {
    console.error("Error updating custom page:", error)
    return jsonResponse({ error: "Failed to update custom page" }, 500)
  }
})

export const DELETE = adminRoute(async ({ supabase, request }, routeContext) => {
  try {
    const id = await resolveId(routeContext, request)
    if (!id) {
      console.warn("[admin/pages/:id] Missing id on DELETE", {
        url: request.url,
        params: routeContext?.params,
      })
      return jsonResponse({ error: "Missing page id" }, 400)
    }

    const { error } = await supabase.from("custom_pages").delete().eq("id", id)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (error) {
    console.error("Error deleting custom page:", error)
    return jsonResponse({ error: "Failed to delete custom page" }, 500)
  }
})
