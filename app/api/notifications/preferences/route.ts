import { NextResponse } from "next/server"
import { fetchNotificationPreferencesFromContabo } from "@/lib/database/contabo-queries"
import { updateNotificationPreferencesInContabo } from "@/lib/database/contabo-writes"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"

export async function GET() {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use Contabo
    const preferences = await fetchNotificationPreferencesFromContabo(session.user.id)
    if (!preferences) {
      // Create default preferences if they don't exist
      const pool = getContaboPool()
      try {
        await pool.query(
          `INSERT INTO notification_preferences (user_id, email_new_episodes, email_comment_replies, email_weekly_digest, email_new_favorites, email_marketing, digest_frequency, created_at, updated_at)
           VALUES ($1, true, true, true, false, false, 'weekly', NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [session.user.id]
        )
        // Fetch again after creation
        const newPreferences = await fetchNotificationPreferencesFromContabo(session.user.id)
        if (newPreferences) {
          return NextResponse.json(newPreferences)
        }
      } catch (createError) {
        console.error("[Notifications] Error creating default preferences:", createError)
      }
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
    }
    return NextResponse.json(preferences)
  } catch (error) {
    console.error("[v0] Error in notification preferences GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      email_new_episodes,
      email_comment_replies,
      email_weekly_digest,
      email_new_favorites,
      email_marketing,
      digest_frequency,
    } = body

    // Use Contabo
    const data = await updateNotificationPreferencesInContabo(session.user.id, {
      email_new_episodes,
      email_comment_replies,
      email_weekly_digest,
      email_new_favorites,
      email_marketing,
      digest_frequency,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error in notification preferences PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

