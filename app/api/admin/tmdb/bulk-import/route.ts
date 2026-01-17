import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { invalidateCache } from "@/lib/cache"

// Set maximum duration to 10 minutes for bulk imports (series with many episodes can take time)
export const maxDuration = 600 // 10 minutes
export const dynamic = 'force-dynamic'

export const POST = adminRoute(async ({ request, supabase, adminUser }) => {
  try {
    const body = await request.json()
    const { tmdb_ids, type, quality } = body

    if (!tmdb_ids || !Array.isArray(tmdb_ids) || tmdb_ids.length === 0) {
      return NextResponse.json({ error: "TMDB IDs array is required" }, { status: 400 })
    }

    // Limit bulk import - reduced to 10 items per batch to avoid Nginx 60s timeout
    // If Nginx timeout is increased to 600s, this can be increased back to 100
    const maxBulkImport = 10 // Max 10 items per bulk import (to complete in under 60s)
    const idsToImport = tmdb_ids.slice(0, maxBulkImport)
    const skipped = tmdb_ids.length > maxBulkImport ? tmdb_ids.length - maxBulkImport : 0

    if (skipped > 0) {
      console.log(`[v0] Bulk import limited to ${maxBulkImport} items, skipping ${skipped}`)
    }

    const results = {
      success: [],
      failed: [],
      retried: [],
    }

    // Use service role client for bulk operations to bypass RLS
    const serviceSupabase = createServiceRoleClient()

    // Import each item by calling the import endpoint directly
    // Use a bypass header to indicate this is an internal call
    const internalHeader = "x-internal-bulk-import"
    const csrfToken = request.headers.get("X-CSRF-Token") || request.cookies.get("csrf_token")?.value
    // Get the admin session cookie - it's called "admin_session" (lowercase)
    const adminSessionCookie = request.cookies.get("admin_session")?.value
    
    console.log(`[v0] Starting bulk import of ${idsToImport.length} items, Type: ${type || "movie"}`)
    console.log(`[v0] CSRF Token: ${csrfToken ? "present" : "missing"}`)
    console.log(`[v0] Admin Session: ${adminSessionCookie ? "present" : "missing"}`)
    
    // Helper function to import a single item with retry logic
    async function importSingleItem(
      tmdb_id: number,
      contentType: string = type || "movie", // Pass contentType explicitly
      attempt: number = 1,
      maxRetries: number = 2,
    ): Promise<{ success: boolean; title?: string; error?: string }> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout for series with many episodes
      
      try {
        // Use request origin for internal calls - this ensures cookies and headers are preserved
        // Using localhost can fail if the server isn't accessible that way
        const finalImportUrl = `${request.nextUrl.origin}/api/admin/import-tmdb`
        console.log(`[v0] Using import URL: ${finalImportUrl}`)
        const importPayload = {
          tmdb_input: tmdb_id.toString(),
          quality: quality || "HD",
          contentType: contentType,
        }
        
        console.log(`[v0] Calling import endpoint for ${tmdb_id} (${contentType}):`, finalImportUrl)
        console.log(`[v0] Payload:`, JSON.stringify(importPayload))
        
        // Build cookie header for internal fetch - must preserve exact cookie format
        // Use the original Cookie header from the request, which already has all cookies properly formatted
        const originalCookieHeader = request.headers.get("Cookie") || ""
        
        // Log cookie status for debugging
        console.log(`[v0] Original cookie header: ${originalCookieHeader ? "present" : "missing"}`)
        console.log(`[v0] Admin session cookie value: ${adminSessionCookie ? "present (" + adminSessionCookie.substring(0, 20) + "...)" : "missing"}`)
        
        // Ensure we have the essential cookies - use original if available, otherwise build from scratch
        let cookieHeader = originalCookieHeader
        if (!cookieHeader || !cookieHeader.includes("admin_session=")) {
          // Build cookie header from individual cookies if original is missing or incomplete
          const cookieParts = []
          if (adminSessionCookie) {
            cookieParts.push(`admin_session=${adminSessionCookie}`)
          }
          if (csrfToken) {
            cookieParts.push(`csrf_token=${encodeURIComponent(csrfToken)}`)
          }
          // Add any other cookies from the request
          request.cookies.getAll().forEach(cookie => {
            if (cookie.name !== "admin_session" && cookie.name !== "csrf_token") {
              cookieParts.push(`${cookie.name}=${cookie.value}`)
            }
          })
          if (cookieParts.length > 0) {
            cookieHeader = cookieParts.join("; ")
          }
        }
        
        console.log(`[v0] Final cookie header for internal fetch: ${cookieHeader ? "present" : "missing"}`)
        
        const fetchHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          [internalHeader]: "true",
        }
        
        if (csrfToken) {
          fetchHeaders["X-CSRF-Token"] = csrfToken
        }
        
        if (cookieHeader) {
          fetchHeaders["Cookie"] = cookieHeader
        }
        
        const importResponse = await fetch(finalImportUrl, {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify(importPayload),
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        const responseStatus = importResponse.status
        console.log(`[v0] Import response for ${tmdb_id}: Status ${responseStatus}`)
        
        // Log response headers for debugging
        console.log(`[v0] Response headers for ${tmdb_id}:`, Object.fromEntries(importResponse.headers.entries()))

        if (!importResponse.ok) {
          console.error(`[v0] Import FAILED for ${tmdb_id}: HTTP ${responseStatus}`)
          let errorMsg = `HTTP ${importResponse.status}`
          let errorDetails = null
          try {
            const errorData = await importResponse.json()
            errorMsg = errorData.error || errorMsg
            errorDetails = errorData
            console.error(`[v0] Import failed for ${tmdb_id}:`, errorData)
          } catch (parseError) {
            const errorText = await importResponse.text().catch(() => "")
            errorMsg = importResponse.statusText || errorMsg
            console.error(`[v0] Import failed for ${tmdb_id}: Status ${importResponse.status}, Body:`, errorText)
          }
          
          // Retry on certain errors (including 401 Unauthorized which might be a cookie issue)
          if (attempt < maxRetries && (importResponse.status >= 500 || importResponse.status === 429 || importResponse.status === 403 || importResponse.status === 401)) {
            console.log(`[v0] Retrying import ${tmdb_id} (attempt ${attempt + 1}/${maxRetries}) - Status: ${importResponse.status}`)
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
            return await importSingleItem(tmdb_id, contentType, attempt + 1, maxRetries)
          }
          
          return { success: false, error: errorMsg, details: errorDetails }
        }

        let importData
        try {
          const responseText = await importResponse.text()
          if (!responseText) {
            console.error(`[v0] Empty response for ${tmdb_id}`)
            return { success: false, error: "Empty response from server" }
          }
          importData = JSON.parse(responseText)
          
          // Verify the response actually indicates success
          if (importData.error) {
            console.error(`[v0] Import endpoint returned error for ${tmdb_id}:`, importData.error)
            return { success: false, error: importData.error || "Import endpoint returned error" }
          }
          
          // Check if we got a title or name (indicates successful import)
          const hasTitle = importData.title || importData.name
          if (!hasTitle) {
            console.error(`[v0] Import response missing title/name for ${tmdb_id}:`, importData)
            return { success: false, error: "Invalid import response - missing title/name" }
          }
          
          console.log(`[v0] Import successful for ${tmdb_id}:`, hasTitle, `(Type: ${importData.type || "unknown"})`)
          return { success: true, title: hasTitle }
        } catch (parseError) {
          console.error(`[v0] Failed to parse import response for ${tmdb_id}:`, parseError)
          return { success: false, error: "Invalid response from server" }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        
        console.error(`[v0] Fetch error importing ${tmdb_id} (attempt ${attempt}):`, fetchError)
        
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          // Retry on timeout
          if (attempt < maxRetries) {
            console.log(`[v0] Timeout importing ${tmdb_id}, retrying (attempt ${attempt + 1}/${maxRetries})`)
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
            return await importSingleItem(tmdb_id, contentType, attempt + 1, maxRetries)
          }
          return { success: false, error: "Import timeout (2 minutes)" }
        }
        
        // Retry on network errors
        if (attempt < maxRetries) {
          console.log(`[v0] Network error importing ${tmdb_id}, retrying (attempt ${attempt + 1}/${maxRetries}):`, fetchError instanceof Error ? fetchError.message : "Unknown error")
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
          return await importSingleItem(tmdb_id, contentType, attempt + 1, maxRetries)
        }
        
        return { success: false, error: fetchError instanceof Error ? fetchError.message : "Import failed" }
      }
    }

    // Track start time for logging
    const startTime = Date.now()
    
    for (let i = 0; i < idsToImport.length; i++) {
      const tmdb_id = idsToImport[i]
      try {
        const elapsedTime = Date.now() - startTime
        console.log(`[v0] Importing ${i + 1}/${idsToImport.length}: TMDB ID ${tmdb_id}, Type: ${type || "movie"} (${Math.round(elapsedTime / 1000)}s elapsed)`)
        
        const result = await importSingleItem(tmdb_id, type || "movie")
        
        if (result.success) {
          results.success.push({ tmdb_id, title: result.title || `TMDB ${tmdb_id}` })
          console.log(`[v0] Successfully imported ${tmdb_id}: ${result.title || tmdb_id}`)
        } else {
          results.failed.push({ tmdb_id, error: result.error || "Import failed" })
          console.error(`[v0] Failed to import ${tmdb_id}:`, result.error)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Import failed"
        results.failed.push({ tmdb_id, error: errorMsg })
        console.error(`[v0] Error importing ${tmdb_id}:`, errorMsg, error)
      }

      // No delay between imports for maximum speed (timeout protection is handled above)
      // This allows us to process more items before hitting Nginx timeout
    }

    console.log(`[v0] Bulk import complete: ${results.success.length} succeeded, ${results.failed.length} failed`)
    
    // Clear cache so new imports appear immediately on the site
    if (results.success.length > 0) {
      const contentType = type || "movie"
      console.log(`[v0] Clearing cache for ${contentType} imports...`)
      try {
        // Clear all movie/series related cache patterns
        await Promise.all([
          invalidateCache(`movies:${contentType}:*`),
          invalidateCache(`latest:${contentType}:*`),
          invalidateCache(`trending:${contentType}:*`),
          invalidateCache(`similar:*`), // Clear similar movies cache too
          // Also clear any cache with the type prefix
          invalidateCache(`*:${contentType}:*`),
        ])
        console.log(`[v0] Cache cleared for ${contentType}`)
      } catch (cacheError) {
        console.error(`[v0] Error clearing cache:`, cacheError)
        // Don't fail the import if cache clearing fails
      }
    }
    
    // Log summary of failures for debugging
    if (results.failed.length > 0) {
      console.error(`[v0] Failed imports summary:`)
      results.failed.forEach((f: any) => {
        console.error(`  - TMDB ${f.tmdb_id}: ${f.error}`)
        if (f.details) {
          console.error(`    Details:`, JSON.stringify(f.details))
        }
      })
    }
    
    // Log summary of successes
    if (results.success.length > 0) {
      console.log(`[v0] Successful imports:`)
      results.success.forEach((s: any) => {
        console.log(`  - TMDB ${s.tmdb_id}: ${s.title || s.tmdb_id}`)
      })
    }

    return NextResponse.json({
      success: results.success.length > 0,
      imported: results.success.length,
      failed: results.failed.length,
      skipped,
      total: tmdb_ids.length,
      results,
      _note: skipped > 0 ? `Import limited to ${maxBulkImport} items. Please import in smaller batches.` : undefined,
    })
  } catch (error) {
    console.error("[v0] Bulk import error:", error)
    return NextResponse.json({ error: "Bulk import failed" }, { status: 500 })
  }
})
