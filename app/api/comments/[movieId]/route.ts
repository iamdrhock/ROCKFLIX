import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchCommentsFromContabo } from "@/lib/database/contabo-queries"

export async function GET(request: Request, { params }: { params: Promise<{ movieId: string }> }) {
  try {
    const { movieId } = await params
    const movieIdNum = Number.parseInt(movieId)

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const comments = await fetchCommentsFromContabo(movieIdNum)
      
      // Filter only approved comments and format to match expected format
      const approvedComments = comments
        .filter((c: any) => c.moderation_status === 'approved')
        .map((c: any) => {
          const profile = c.profiles || {
            username: c.user_name || '',
            profile_picture_url: null,
            reputation_score: 0,
          }
          
          return {
            ...c,
            comment: c.comment_text || c.comment || '',
            profiles: profile,
            // Also add 'user' for compatibility with watch client
            user: {
              name: profile.username || c.user_name || 'User',
              avatar_url: profile.profile_picture_url || null,
            },
          }
        })

      return NextResponse.json(approvedComments)
    }

    // Fallback to Supabase
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        profiles:user_id (
          username,
          profile_picture_url,
          reputation_score
        )
      `,
      )
      .eq("movie_id", movieIdNum)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Supabase error fetching comments:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[v0] Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}
