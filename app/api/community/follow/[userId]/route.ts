import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { followUserInContabo, unfollowUserInContabo } from "@/lib/database/contabo-writes"

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.id === userId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      try {
        await followUserInContabo(user.id, userId)
        return NextResponse.json({ success: true })
      } catch (error: any) {
        if (error.message === 'Already following') {
          return NextResponse.json({ error: "Already following" }, { status: 400 })
        }
        throw error
      }
    }

    const { error } = await supabase.from("user_follows").insert({
      follower_id: user.id,
      following_id: userId,
    })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already following" }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error following user:", error)
    return NextResponse.json({ error: "Failed to follow user" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      await unfollowUserInContabo(user.id, userId)
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unfollowing user:", error)
    return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 })
  }
}
