import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"

// Force dynamic rendering to ensure session is checked on each request
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const session = await getAuthSession()
    const sessionUserId = (session?.user as { id?: string | null; email?: string | null } | null)?.id || null
    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || sessionUserId

    // Only allow users to fetch their own profile
    if (userId !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const pool = getContaboPool()
    const result = await pool.query(
      `SELECT username, profile_picture_url FROM profiles WHERE id = $1 LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile: result.rows[0] })
  } catch (error: any) {
    console.error("[API] Error fetching profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    console.log("[API] PUT /api/user/profile - Starting request")
    console.log("[API] PUT /api/user/profile - Request headers:", {
      cookie: request.headers.get("cookie") ? "Present" : "Missing",
      contentType: request.headers.get("content-type")
    })
    
    const session = await getAuthSession()
    const sessionUserId = (session?.user as { id?: string | null; email?: string | null } | null)?.id || null
    const sessionUserEmail = (session?.user as { email?: string | null } | null)?.email || null
    console.log("[API] PUT /api/user/profile - Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasUserId: !!sessionUserId,
      userId: sessionUserId,
      userEmail: sessionUserEmail
    })
    
    if (!sessionUserId) {
      console.log("[API] PUT /api/user/profile - Unauthorized: No session")
      return NextResponse.json({ 
        error: "Unauthorized", 
        message: "Please log in to update your profile" 
      }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("[API] PUT /api/user/profile - JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { username, country, about, profile_picture_url } = body

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    const pool = getContaboPool()

    // Check if username is already taken by another user
    const usernameCheck = await pool.query(
      "SELECT id FROM profiles WHERE username = $1 AND id != $2 LIMIT 1",
      [username, sessionUserId]
    )

    if (usernameCheck.rows.length > 0) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 })
    }

    // Update profile
    await pool.query(
      `UPDATE profiles 
       SET username = $1, 
           country = $2, 
           about = $3, 
           profile_picture_url = $4 
       WHERE id = $5`,
      [username, country || null, about || null, profile_picture_url || null, sessionUserId]
    )

    console.log("[API] PUT /api/user/profile - Success")
    return NextResponse.json({ success: true, message: "Profile updated successfully" })
  } catch (error: any) {
    console.error("[API] Error updating profile:", error)
    console.error("[API] Error stack:", error?.stack)
    // Always return JSON, never HTML
    return NextResponse.json({ 
      error: "Failed to update profile", 
      details: error?.message || "Unknown error",
      type: error?.name || "Error"
    }, { 
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    })
  }
}

