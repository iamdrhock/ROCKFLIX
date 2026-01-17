import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Diagnostic endpoint to help troubleshoot admin login issues
 * This endpoint does NOT require authentication - it's for diagnostics only
 */
export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    issues: [],
    status: "ok",
  }

  try {
    // Check database connection
    try {
      const supabase = createServiceRoleClient()
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, username")
        .limit(1)

      if (error) {
        diagnostics.issues.push(`Database connection error: ${error.message}`)
        diagnostics.status = "error"
      } else {
        diagnostics.database = {
          connected: true,
          adminUsersExist: (data?.length || 0) > 0,
        }
      }
    } catch (dbError: any) {
      diagnostics.issues.push(`Database error: ${dbError.message}`)
      diagnostics.status = "error"
      diagnostics.database = { connected: false }
    }

    // Check Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const result = await queryContabo('SELECT COUNT(*) as count FROM admin_users')
        diagnostics.contabo = {
          enabled: true,
          connected: true,
          adminUsersCount: result.rows[0]?.count || 0,
        }
      } catch (contaboError: any) {
        diagnostics.issues.push(`Contabo connection error: ${contaboError.message}`)
        diagnostics.status = "error"
        diagnostics.contabo = { enabled: true, connected: false }
      }
    } else {
      diagnostics.contabo = { enabled: false }
    }

    // Check environment variables
    diagnostics.environment = {
      useContabo: process.env.USE_CONTABO_DB === 'true',
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
    }

    // Check session cookie
    const sessionCookie = request.cookies.get("admin_session")
    diagnostics.session = {
      cookiePresent: !!sessionCookie,
      cookieValue: sessionCookie ? "present" : "missing",
    }

    // Check CSRF token
    const csrfToken = request.cookies.get("csrf_token")
    diagnostics.csrf = {
      tokenPresent: !!csrfToken,
    }

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error: any) {
    diagnostics.issues.push(`Diagnostic error: ${error.message}`)
    diagnostics.status = "error"
    return NextResponse.json(diagnostics, { status: 500 })
  }
}

