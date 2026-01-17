import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchNotificationsFromContabo } from "@/lib/database/contabo-queries"
import { updateNotificationsReadStatusInContabo } from "@/lib/database/contabo-writes"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[v0] Using Contabo for notifications")
      const notifications = await fetchNotificationsFromContabo({
        userId: user.id,
        unreadOnly,
        limit,
        offset,
      })
      return NextResponse.json(notifications)
    }

    // Fallback to Supabase
    let query = supabase
      .from("talkflix_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq("read", false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error("[v0] Error fetching notifications:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unique actor IDs
    const actorIds = [...new Set(notifications.map((n) => n.actor_id))]

    // Fetch actor profiles with safety limit to prevent resource exhaustion
    // Supabase .in() has a limit of ~1000 items, so we batch if needed
    let actors: any[] = []
    if (actorIds.length > 0) {
      const batchSize = 1000
      for (let i = 0; i < actorIds.length; i += batchSize) {
        const batch = actorIds.slice(i, i + batchSize)
        const { data: batchActors } = await supabase
          .from("profiles")
          .select("id, username, profile_picture_url")
          .in("id", batch)
        if (batchActors) {
          actors = actors.concat(batchActors)
        }
      }
    }

    // Create actor map
    const actorMap = new Map(actors?.map((a) => [a.id, a]) || [])

    // Merge data
    const enrichedNotifications = notifications.map((notification) => ({
      ...notification,
      actor: actorMap.get(notification.actor_id),
    }))

    return NextResponse.json(enrichedNotifications)
  } catch (error) {
    console.error("[v0] Error in notifications GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, markAsRead } = body

    if (!Array.isArray(notificationIds)) {
      return NextResponse.json({ error: "Invalid notification IDs" }, { status: 400 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[v0] Using Contabo to update notifications")
      await updateNotificationsReadStatusInContabo(user.id, notificationIds, markAsRead)
      return NextResponse.json({ success: true })
    }

    // Fallback to Supabase
    const { error } = await supabase
      .from("talkflix_notifications")
      .update({ read: markAsRead })
      .eq("user_id", user.id)
      .in("id", notificationIds)

    if (error) {
      console.error("[v0] Error updating notifications:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in notifications PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
