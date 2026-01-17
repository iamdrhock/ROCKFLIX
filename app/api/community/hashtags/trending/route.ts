import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { fetchTrendingHashtagsFromContabo } from "@/lib/database/contabo-queries"

export async function GET() {
  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      const hashtags = await fetchTrendingHashtagsFromContabo(10)
      return NextResponse.json({ hashtags: hashtags.map(h => ({ name: h.name, post_count: h.post_count })) })
    }

    const supabase = await createClient()

    const { data: hashtags, error } = await supabase
      .from("hashtags")
      .select("name, post_count")
      .order("post_count", { ascending: false })
      .limit(10)

    if (error) throw error

    return NextResponse.json({ hashtags: hashtags || [] })
  } catch (error) {
    console.error("Error fetching trending hashtags:", error)
    return NextResponse.json({ error: "Failed to fetch trending hashtags" }, { status: 500 })
  }
}
