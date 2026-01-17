import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { markAllNotificationsReadInContabo } from "@/lib/database/contabo-writes"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      await markAllNotificationsReadInContabo(user.id)
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase
      .from("talkflix_notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)

    if (error) {
      console.error("[v0] Error marking all as read:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in mark all read:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
