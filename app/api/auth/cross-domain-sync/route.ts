/**
 * Cross-domain sync endpoint
 * This is called via iframe from the other domain to trigger session sync
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const email = searchParams.get("email")
    const from = searchParams.get("from")

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    // This endpoint is called via iframe, so we can't set cookies directly
    // Instead, we return a script that the iframe can execute to trigger sync
    
    const cookieStore = await cookies()
    const isRockflix = request.headers.get("host")?.includes("rockflix") || false
    const isTalkFlix = request.headers.get("host")?.includes("talkflix") || false

    // Return a simple HTML page with a script that triggers postMessage
    const script = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Syncing...</title>
        </head>
        <body>
          <script>
            // Notify parent window that sync is needed
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'CROSS_DOMAIN_AUTH_SYNC',
                userId: '${userId}',
                email: '${email}',
                from: '${from}',
                target: '${isRockflix ? 'rockflix' : 'talkflix'}'
              }, '*');
            }
            // Also set a localStorage flag that the other domain can check
            try {
              localStorage.setItem('auth_sync_needed', JSON.stringify({
                userId: '${userId}',
                email: '${email}',
                timestamp: Date.now()
              }));
            } catch(e) {}
          </script>
        </body>
      </html>
    `

    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/html",
      },
    })
  } catch (error: any) {
    console.error("[API] Error in cross-domain sync:", error)
    return NextResponse.json(
      { error: "Failed to sync", details: error?.message },
      { status: 500 }
    )
  }
}

