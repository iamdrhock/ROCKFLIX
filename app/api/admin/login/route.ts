import bcrypt from "bcryptjs"
import { type NextRequest, NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/server"
import { createAdminSession, setAdminSessionCookie } from "@/lib/security/admin-middleware"
import { generateCsrfToken, setCsrfTokenCookie } from "@/lib/security/csrf"
import { rateLimiters } from "@/lib/security/rate-limit"

// Helper to safely use NextResponse or fallback to native Response
function safeJsonResponse(data: any, status: number = 200) {
  try {
    if (typeof NextResponse !== 'undefined' && NextResponse && NextResponse.json) {
      return NextResponse.json(data, { status })
    }
  } catch (e) {
    // Fall through
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export async function POST(request: NextRequest) {
  console.log("[admin] Login POST request received")
  try {
    // Rate limiting for login attempts
    try {
      console.log("[admin] Checking rate limit...")
      const rateLimitCheck = rateLimiters.login(request)
      console.log("[admin] Rate limit check result:", rateLimitCheck.allowed)
      if (!rateLimitCheck.allowed) {
        console.log("[admin] Rate limit exceeded")
        return rateLimitCheck.response!
      }
    } catch (rateLimitError: any) {
      // If rate limiting fails, log but continue (fail open for login)
      console.error("[admin] Rate limit check failed:", rateLimitError?.message || rateLimitError)
      // Continue with login attempt
    }

    console.log("[admin] Parsing request body...")
    const { username, password } = await request.json()
    console.log("[admin] Username received:", username ? "yes" : "no")

    if (!username || !password) {
      return safeJsonResponse({ error: "Username and password are required" }, 400)
    }

    console.log("[admin] Creating service role client...")
    const supabase = createServiceRoleClient()
    console.log("[admin] Service role client created")

    const normalizedUsername = String(username).trim()
    const passwordInputRaw = String(password)
    const passwordInput = passwordInputRaw.replace(/\u00a0/g, " ").trim()

    console.log("[admin] Fetching admin user from database...")

    let adminUser: any = null
    let error: any = null

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')

        // Try exact match first
        const exactResult = await queryContabo<any>(
          'SELECT id, username, password_hash, password FROM admin_users WHERE username = $1 LIMIT 1',
          [normalizedUsername]
        )

        if (exactResult.rows.length > 0) {
          adminUser = exactResult.rows[0]
        } else {
          // Try case-insensitive match
          const caseInsensitiveResult = await queryContabo<any>(
            'SELECT id, username, password_hash, password FROM admin_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [normalizedUsername]
          )

          if (caseInsensitiveResult.rows.length > 0) {
            adminUser = caseInsensitiveResult.rows[0]
          }
        }
      } catch (contaboError: any) {
        console.error("[admin/login] Contabo error:", contaboError)
        // Fall through to Supabase fallback
      }
    }

    // Fallback to Supabase if Contabo didn't work or isn't enabled
    if (!adminUser) {
      const { data: adminUserExact, error: exactMatchError } = await supabase
        .from("admin_users")
        .select("id, username, password_hash, password")
        .eq("username", normalizedUsername)
        .limit(1)
        .maybeSingle()

      adminUser = adminUserExact
      error = exactMatchError

      if (!adminUser) {
        const { data: adminUserCaseInsensitive, error: caseInsensitiveError } = await supabase
          .from("admin_users")
          .select("id, username, password_hash, password")
          .ilike("username", normalizedUsername)
          .limit(1)
          .maybeSingle()

        adminUser = adminUserCaseInsensitive
        error = caseInsensitiveError
      }
    }

    if (error || !adminUser?.id) {
      return safeJsonResponse({ error: "Invalid username or password" }, 401)
    }

    const passwordCandidates = [adminUser.password_hash, adminUser.password].filter(
      (value): value is string => Boolean(value),
    )

    const normalizedCandidates = passwordCandidates.map((candidate) => candidate.trim())

    let verifiedHash: string | null = null

    for (const candidate of normalizedCandidates) {
      try {
        const normalizedCandidate = candidate.replace(/\u00a0/g, " ").trim()
        if (!candidate.startsWith("$2")) {
          if (passwordInput === normalizedCandidate || passwordInput.startsWith(normalizedCandidate)) {
            verifiedHash = await bcrypt.hash(normalizedCandidate, 12)
            break
          }
        } else if (await bcrypt.compare(passwordInput, candidate)) {
          verifiedHash = candidate
          break
        }
      } catch (compareError) {
        // Log error without sensitive details
        if (process.env.NODE_ENV === "development") {
          console.warn("[admin] Failed to compare password hash")
        }
      }
    }

    if (!verifiedHash) {
      return safeJsonResponse({ error: "Invalid username or password" }, 401)
    }

    if (!adminUser.password_hash || adminUser.password_hash !== verifiedHash) {
      // Update password hash in Contabo if enabled
      if (process.env.USE_CONTABO_DB === 'true') {
        try {
          const { queryContabo } = await import('@/lib/database/contabo-pool')
          await queryContabo(
            'UPDATE admin_users SET password_hash = $1, password = NULL WHERE id = $2',
            [verifiedHash, adminUser.id]
          )
        } catch (contaboError: any) {
          console.error("[admin/login] Contabo error updating password:", contaboError)
          // Fall through to Supabase fallback
        }
      }

      // Fallback to Supabase
      if (process.env.USE_CONTABO_DB !== 'true') {
        await supabase
          .from("admin_users")
          .update({ password_hash: verifiedHash, password: null })
          .eq("id", adminUser.id)
      }
    }

    // Create admin session
    const { cookie, expiresAt } = await createAdminSession(supabase, adminUser.id, request)
    const csrfToken = generateCsrfToken()

    // Unified response handling: Create response and set cookies
    const response = safeJsonResponse({
      success: true,
      user: {
        id: adminUser.id,
        username: adminUser.username,
      },
      csrfToken,
    })

    // Always attempt to set cookies on the response object
    // This works for both NextResponse (via .cookies) and native Response (via headers)
    setAdminSessionCookie(response, cookie, expiresAt)
    setCsrfTokenCookie(response, csrfToken)

    return response
  } catch (error: any) {
    console.error("[admin] Login error:", error)
    console.error("[admin] Login error message:", error?.message)
    console.error("[admin] Login error stack:", error?.stack)
    return safeJsonResponse({
      error: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { details: error?.message })
    }, 500)
  }
}
