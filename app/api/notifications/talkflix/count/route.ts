import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUnreadNotificationCountFromContabo } from "@/lib/database/contabo-queries"

export async function GET() {
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
      const count = await getUnreadNotificationCountFromContabo(user.id)
      return NextResponse.json({ count })
    }

    const { count, error } = await supabase
      .from("talkflix_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)

    if (error) {
      console.error("[v0] Error counting notifications:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error("[v0] Error in notifications count GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
