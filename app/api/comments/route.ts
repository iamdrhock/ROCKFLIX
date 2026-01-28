import { NextResponse } from "next/server"
import { checkSpam, checkUserCanComment, updateUserReputation } from "@/lib/moderation"
import { sanitizeHtml } from "@/lib/security/validation"
import { rateLimiters } from "@/lib/security/rate-limit"
import { checkRequestSize } from "@/lib/security/request-limits"
import type { NextRequest } from "next/server"
import { addCommentToContabo, getProfileFromContabo, incrementProfileFieldContabo } from "@/lib/database/contabo-writes"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getAuthSession()

    const userData = session?.user as { id?: string | null; email?: string | null } | null
    const userId = userData?.id || null
    const userEmail = userData?.email || null
    if (!userId) {
      return NextResponse.json({ error: "You must be logged in to comment" }, { status: 401 })
    }

    // Check request size
    const sizeCheck = checkRequestSize(request)
    if (!sizeCheck.valid) {
      return sizeCheck.response!
    }

    // Rate limiting per user
    const rateLimitResult = rateLimiters.comments(request, userId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "You're commenting too quickly. Please wait a moment.",
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    const canCommentCheck = await checkUserCanComment(userId)
    if (!canCommentCheck.canComment) {
      return NextResponse.json({ error: canCommentCheck.reason }, { status: 403 })
    }

    const body = await request.json()
    const { movie_id, comment } = body

    if (!movie_id || !comment) {
      return NextResponse.json({ error: "Movie ID and comment are required" }, { status: 400 })
    }

    // Sanitize comment to prevent XSS
    const sanitizedComment = sanitizeHtml(comment.trim())
    
    if (!sanitizedComment || sanitizedComment.length === 0) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
    }

    // Limit comment length
    if (sanitizedComment.length > 2000) {
      return NextResponse.json({ error: "Comment must be 2000 characters or less" }, { status: 400 })
    }

    const spamCheck = await checkSpam(sanitizedComment)

    // Use Contabo
    try {
      // Get user profile to fetch username
      let profile = await getProfileFromContabo(userId)
      
      // If profile doesn't exist, create a basic one
      if (!profile) {
        const pool = getContaboPool()
        const defaultUsername = userEmail?.split("@")[0] || `user_${userId.substring(0, 8)}`
        
        try {
          await pool.query(
            `INSERT INTO profiles (id, username, email, role, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [userId, defaultUsername, userEmail || null, 'user']
          )
          // Fetch the newly created profile
          profile = await getProfileFromContabo(userId)
        } catch (createError) {
          console.error("[Comments] Error creating profile:", createError)
          // Continue with default username if profile creation fails
        }
      }
      
      const userName = profile?.username || userEmail?.split("@")[0] || "User"

      const data = await addCommentToContabo(
        Number.parseInt(movie_id),
        userId,
        userName,
        sanitizedComment,
        spamCheck.isSpam,
        spamCheck.spamScore,
        spamCheck.isSpam ? "pending" : "approved"
      )

      // Increment profile counters (don't fail if these fail)
      try {
        await incrementProfileFieldContabo(userId, "comments_posted")
      } catch (err) {
        console.error("[v0] Error incrementing comments_posted:", err)
      }

      if (!spamCheck.isSpam) {
        try {
          await incrementProfileFieldContabo(userId, "comments_approved")
          await updateUserReputation(userId)
        } catch (err) {
          console.error("[v0] Error updating reputation:", err)
        }
      }

      if (spamCheck.isSpam) {
        return NextResponse.json(
          {
            ...data,
            warning: "Your comment has been flagged for review and will be visible after moderation.",
          },
          { status: 201 },
        )
      }

      return NextResponse.json(data, { status: 201 })
    } catch (contaboError: any) {
      console.error("[v0] Error posting comment to Contabo:", contaboError)
      console.error("[v0] Error details:", {
        message: contaboError?.message,
        code: contaboError?.code,
        detail: contaboError?.detail,
        stack: contaboError?.stack
      })
      return NextResponse.json(
        { 
          error: "Failed to post comment",
          details: contaboError?.message || "Database error"
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[v0] Error posting comment:", error)
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
  }
}

