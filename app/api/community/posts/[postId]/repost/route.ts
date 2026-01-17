import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRepostStatusInContabo, toggleRepostInContabo } from "@/lib/database/contabo-writes"

export async function GET(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const supabase = await createClient()
    const { postId } = await params

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const isReposted = await checkRepostStatusInContabo(Number.parseInt(postId), user.id)
      return NextResponse.json({ isReposted })
    }

    // Fallback to Supabase
    const { data: existingRepost } = await supabase
      .from("post_reposts")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle()

    return NextResponse.json({ isReposted: !!existingRepost })
  } catch (error) {
    console.error("[v0] Error checking repost status:", error)
    return NextResponse.json({ error: "Failed to check repost status" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params
    console.log("[v0] Repost API called for post:", postId)

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log("[v0] Repost API - Unauthorized, authError:", authError?.message)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] User authenticated:", user.id)

    const body = await request.json()
    const { quote_content } = body
    console.log("[v0] Repost request body:", { quote_content })

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const result = await toggleRepostInContabo(Number.parseInt(postId), user.id, quote_content || null)
      return NextResponse.json(result)
    }

    // Fallback to Supabase
    // Check if already reposted
    const { data: existingRepost, error: checkError } = await supabase
      .from("post_reposts")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (checkError) {
      console.error("[v0] Error checking existing repost:", checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    console.log("[v0] Existing repost check:", existingRepost ? "already reposted" : "not reposted")

    if (existingRepost) {
      // Un-repost
      console.log("[v0] Un-reposting...")
      const { error: deleteError } = await supabase
        .from("post_reposts")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)

      if (deleteError) {
        console.error("[v0] Error deleting repost:", deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      console.log("[v0] Un-repost successful")
      return NextResponse.json({ reposted: false, message: "Repost removed" })
    } else {
      console.log("[v0] Creating new repost/quote...")
      const { data: insertData, error: insertError } = await supabase
        .from("post_reposts")
        .insert({
          post_id: postId,
          user_id: user.id,
          quote_content: quote_content || null,
        })
        .select()
        .single()

      if (insertError) {
        console.error("[v0] Error inserting repost:", insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      console.log("[v0] Repost created successfully:", insertData?.id)

      return NextResponse.json({
        reposted: true,
        message: quote_content ? "Quote posted successfully" : "Reposted successfully",
      })
    }
  } catch (error) {
    console.error("[v0] Error in repost API:", error)
    return NextResponse.json({ error: "Failed to process repost" }, { status: 500 })
  }
}
