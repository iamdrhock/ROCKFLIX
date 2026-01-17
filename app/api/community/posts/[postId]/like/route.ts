import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { likePostInContabo, unlikePostInContabo } from "@/lib/database/contabo-writes"

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const like = await likePostInContabo(Number.parseInt(postId), user.id)
        return NextResponse.json({ success: true, like })
      } catch (error: any) {
        if (error.message === 'Already liked') {
          return NextResponse.json({ error: "Already liked" }, { status: 400 })
        }
        throw error
      }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from("post_likes")
      .insert({
        post_id: Number.parseInt(postId),
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already liked" }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ success: true, like: data })
  } catch (error) {
    console.error("Error liking post:", error)
    return NextResponse.json({ error: "Failed to like post" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      await unlikePostInContabo(Number.parseInt(postId), user.id)
      return NextResponse.json({ success: true })
    }

    // Fallback to Supabase
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", Number.parseInt(postId))
      .eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unliking post:", error)
    return NextResponse.json({ error: "Failed to unlike post" }, { status: 500 })
  }
}
