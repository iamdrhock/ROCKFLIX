import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/"

  try {
    if (code) {
      const supabase = await createClient()
      await supabase.auth.exchangeCodeForSession(code)
      console.log("[auth/callback] Session exchange succeeded")
    } else {
      console.warn("[auth/callback] Missing `code` parameter on callback")
    }
  } catch (error) {
    console.error("[auth/callback] Failed to exchange auth code:", error)
    const errorUrl = new URL(next, requestUrl.origin)
    errorUrl.searchParams.set("auth_error", "session_exchange_failed")
    return NextResponse.redirect(errorUrl)
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${requestUrl.protocol}//${requestUrl.host}`

  return NextResponse.redirect(new URL(next, siteUrl))
}
