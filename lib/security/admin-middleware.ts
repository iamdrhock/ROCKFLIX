import { randomBytes } from "crypto"
import bcrypt from "bcryptjs"
import type { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireCsrfToken } from "@/lib/security/csrf"

const SESSION_COOKIE_NAME = "admin_session"
const SESSION_DURATION_HOURS = Number.parseInt(process.env.ADMIN_SESSION_TTL_HOURS || "12", 10)
const SESSION_MAX_AGE = SESSION_DURATION_HOURS * 60 * 60

// Helper function to create error response - uses native Response API to avoid bundling issues
function createErrorResponse(message: string, status: number = 500) {
  return new Response(
    JSON.stringify({ 
      error: "Internal server error",
      message: message || "An unexpected error occurred",
    }),
    {
      status,
      headers: { "Content-Type": "application/json" }
    }
  )
}

// Helper function to create JSON response - uses native Response only to avoid bundling issues
export function createJsonResponse(data: any, status: number = 200) {
  // Always use native Response to avoid NextResponse bundling issues
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { "Content-Type": "application/json" }
    }
  )
}

interface AdminUser {
  id: number
  username: string
}

interface AdminSessionRow {
  id: number
  session_token: string | null
  expires_at: string | null
  user_id: number
  admin_users: AdminUser | null
}

export interface AdminRequestContext {
  request: NextRequest
  supabase: SupabaseClient<any>
  adminUser: AdminUser
  sessionId: number
}

type AdminRouteHandler = (
  context: AdminRequestContext,
  routeContext?: { params?: Record<string, string | string[]> | Promise<Record<string, string | string[]>> },
) => Promise<Response>

export function adminRoute(handler: AdminRouteHandler) {
  return async (request: NextRequest, routeContext: { params?: Record<string, string | string[]> | Promise<Record<string, string | string[]>> } = {}) => {
    try {
      // Allow bypass for internal server-to-server calls (bulk import)
      const isInternalCall = request.headers.get("x-internal-bulk-import") === "true"
      
      if (isInternalCall) {
        // For internal calls, check if we have a valid admin session
        // If not, still require authentication, but be more lenient with CSRF
        const csrfCheck = requireCsrfToken(request)
        if (!csrfCheck.valid) {
          // For internal calls, if CSRF fails but we have admin session, allow it
          const hasAdminSession = request.cookies.get(SESSION_COOKIE_NAME)?.value
          if (!hasAdminSession) {
            console.error(`[admin/middleware] Internal call missing admin session for ${request.method} ${request.url}`)
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            )
          }
          // Continue with authentication check even if CSRF is missing (internal call)
        }
      } else {
        // Normal CSRF check for external calls
        const csrfCheck = requireCsrfToken(request)
        if (!csrfCheck.valid) {
          console.error(`[admin/middleware] CSRF validation failed for ${request.method} ${request.url}`)
          console.error(`[admin/middleware] Cookie token:`, request.cookies.get("csrf_token")?.value ? "present" : "missing")
          console.error(`[admin/middleware] Header token:`, request.headers.get("X-CSRF-Token") ? "present" : "missing")
          return csrfCheck.response!
        }
      }
      
      const context = await ensureAdmin(request)
      if ("response" in context) {
        if (process.env.NODE_ENV === "development" || isInternalCall) {
          console.log(`[admin/middleware] Authentication failed for ${request.method} ${request.url} (internal: ${isInternalCall})`)
        }
        return context.response
      }

      // Resolve params if it's a Promise (Next.js 16)
      const resolvedParams = routeContext.params instanceof Promise ? await routeContext.params : routeContext.params
      
      return await handler({
        request,
        supabase: context.supabase,
        adminUser: context.adminUser,
        sessionId: context.sessionId,
      }, { params: resolvedParams })
    } catch (error: any) {
      console.error(`[admin/middleware] Unhandled error in adminRoute for ${request.method} ${request.url}:`, error)
      console.error(`[admin/middleware] Error stack:`, error?.stack)
      // Use native Response API directly - NextResponse may not be available in catch block due to bundling
      return new Response(
        JSON.stringify({ 
          error: "Internal server error",
          message: error?.message || "An unexpected error occurred"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      )
    }
  }
}

export async function ensureAdmin(request: NextRequest): Promise<
  | {
      supabase: SupabaseClient<any>
      adminUser: AdminUser
      sessionId: number
    }
  | { response: Response }
> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!cookie) {
    return { response: unauthorizedResponse() }
  }

  const [sessionIdPart, token] = cookie.split(".")
  const sessionId = Number.parseInt(sessionIdPart || "", 10)

  if (!sessionId || !token) {
    return { response: unauthorizedResponse() }
  }

  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<{ response: Response }>((resolve) => {
        setTimeout(() => {
          console.error("[admin/middleware] Database query timeout in ensureAdmin")
          resolve({ response: unauthorizedResponse() })
        }, 5000) // 5 second timeout
      })

      // Query admin session with user info from Contabo
      const sessionPromise = (async () => {
        const sessionResult = await queryContabo<any>(
          `SELECT 
            s.id, 
            s.session_token, 
            s.expires_at, 
            s.user_id,
            u.id as user_id_check,
            u.username
          FROM admin_sessions s
          LEFT JOIN admin_users u ON s.user_id = u.id
          WHERE s.id = $1`,
          [sessionId]
        )

        if (sessionResult.rows.length === 0 || !sessionResult.rows[0].username) {
          // Delete invalid session
          await queryContabo('DELETE FROM admin_sessions WHERE id = $1', [sessionId]).catch(() => {})
          return { response: unauthorizedResponse() }
        }

        const session = sessionResult.rows[0]

        if (!session.session_token) {
          await queryContabo('DELETE FROM admin_sessions WHERE id = $1', [sessionId]).catch(() => {})
          return { response: unauthorizedResponse() }
        }

        const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : null
        if (expiresAt && expiresAt < Date.now()) {
          await queryContabo('DELETE FROM admin_sessions WHERE id = $1', [sessionId]).catch(() => {})
          return { response: unauthorizedResponse() }
        }

        const tokenMatches = await bcrypt.compare(token, session.session_token)
        if (!tokenMatches) {
          await queryContabo('DELETE FROM admin_sessions WHERE id = $1', [sessionId]).catch(() => {})
          return { response: unauthorizedResponse() }
        }

        // Return with Supabase client (for compatibility, but we're using Contabo)
        const supabase = createServiceRoleClient()
        return {
          supabase,
          adminUser: {
            id: session.user_id,
            username: session.username
          },
          sessionId: session.id,
        }
      })()

      // Race between database query and timeout
      return await Promise.race([sessionPromise, timeoutPromise])
    } catch (contaboError: any) {
      console.error("[admin/middleware] Contabo error in ensureAdmin:", contaboError)
      // Fall through to Supabase fallback
    }
  }

  // Fallback to Supabase
  const supabase = createServiceRoleClient()

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("id, session_token, expires_at, user_id, admin_users (id, username)")
    .eq("id", sessionId)
    .maybeSingle<AdminSessionRow>()

  if (error || !session || !session.admin_users) {
    await supabase.from("admin_sessions").delete().eq("id", sessionId)
    return { response: unauthorizedResponse() }
  }

  if (!session.session_token) {
    await supabase.from("admin_sessions").delete().eq("id", sessionId)
    return { response: unauthorizedResponse() }
  }

  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : null
  if (expiresAt && expiresAt < Date.now()) {
    await supabase.from("admin_sessions").delete().eq("id", sessionId)
    return { response: unauthorizedResponse() }
  }

  const tokenMatches = await bcrypt.compare(token, session.session_token)
  if (!tokenMatches) {
    await supabase.from("admin_sessions").delete().eq("id", sessionId)
    return { response: unauthorizedResponse() }
  }

  return {
    supabase,
    adminUser: session.admin_users,
    sessionId: session.id,
  }
}

export async function createAdminSession(
  supabase: SupabaseClient<any>,
  userId: number,
  request: NextRequest,
): Promise<{ cookie: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = await bcrypt.hash(rawToken, 12)

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)

  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      
      const result = await queryContabo<{ id: number }>(
        `INSERT INTO admin_sessions (
          user_id, 
          session_token, 
          ip_address, 
          user_agent, 
          expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [
          userId,
          tokenHash,
          request.headers.get("x-forwarded-for") || request.ip || null,
          request.headers.get("user-agent") || null,
          expiresAt.toISOString()
        ]
      )

      if (result.rows.length === 0) {
        throw new Error("Failed to create admin session in Contabo")
      }

      const cookieValue = `${result.rows[0].id}.${rawToken}`
      return { cookie: cookieValue, expiresAt }
    } catch (contaboError: any) {
      console.error("[admin/middleware] Contabo error in createAdminSession:", contaboError)
      // Fall through to Supabase fallback
    }
  }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from("admin_sessions")
    .insert({
      user_id: userId,
      session_token: tokenHash,
      ip_address: request.headers.get("x-forwarded-for") || request.ip || null,
      user_agent: request.headers.get("user-agent"),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single()

  if (error || !data) {
    throw error || new Error("Failed to create admin session")
  }

  const cookieValue = `${data.id}.${rawToken}`
  return { cookie: cookieValue, expiresAt }
}

export async function destroyAdminSession(
  supabase: SupabaseClient<any>,
  sessionId: number,
): Promise<void> {
  await supabase.from("admin_sessions").delete().eq("id", sessionId)
}

export function unauthorizedResponse() {
  const response = new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  )
  // Note: Can't delete cookies with native Response, but NextResponse wrapper handles it
  // For now, just return the response - cookie deletion will be handled by NextResponse wrapper
  return response
}

export function setAdminSessionCookie(response: Response, value: string, expiresAt: Date) {
  try {
    // Try to use NextResponse cookies API if available
    if ((response as any).cookies && typeof (response as any).cookies.set === 'function') {
      (response as any).cookies.set({
        name: SESSION_COOKIE_NAME,
        value,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: SESSION_MAX_AGE,
        expires: expiresAt,
      })
      return
    }
  } catch (e) {
    // Fall through to manual header
  }
  
  // Fallback: Set cookie manually via Set-Cookie header
  const cookieValue = `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_MAX_AGE}; Expires=${expiresAt.toUTCString()}`
  response.headers.append("Set-Cookie", cookieValue)
}

export function clearAdminSessionCookie(response: Response) {
  try {
    // Try to use NextResponse cookies API if available
    if ((response as any).cookies && typeof (response as any).cookies.delete === 'function') {
      (response as any).cookies.delete(SESSION_COOKIE_NAME, { path: "/" })
      return
    }
  } catch (e) {
    // Fall through to manual header
  }
  
  // Fallback: Clear cookie manually via Set-Cookie header
  const cookieValue = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  response.headers.append("Set-Cookie", cookieValue)
}
