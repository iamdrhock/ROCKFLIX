import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { followSeriesInContabo, unfollowSeriesInContabo } from "@/lib/database/contabo-writes"
import { fetchFollowedSeriesFromContabo } from "@/lib/database/contabo-queries"
import { queryContabo } from "@/lib/database/contabo-pool"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "You must be logged in to follow a series" }, { status: 401 })
    }

    const { series_id } = await request.json()

    if (!series_id) {
      return NextResponse.json({ error: "Series ID is required" }, { status: 400 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      // Check if series exists
      const seriesResult = await queryContabo<{ id: number; type: string }>(
        `SELECT id, type FROM movies WHERE id = $1 AND type = 'series'`,
        [Number.parseInt(series_id)]
      )

      if (seriesResult.rows.length === 0) {
        return NextResponse.json({ error: "Series not found" }, { status: 404 })
      }

      try {
        const data = await followSeriesInContabo(user.id, Number.parseInt(series_id))
        return NextResponse.json({ success: true, data }, { status: 201 })
      } catch (error: any) {
        if (error.message === 'Already following') {
          return NextResponse.json({ error: "You are already following this series" }, { status: 409 })
        }
        throw error
      }
    }

    // Check if series exists
    const { data: series, error: seriesError } = await supabase
      .from("movies")
      .select("id, type")
      .eq("id", series_id)
      .eq("type", "series")
      .single()

    if (seriesError || !series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 })
    }

    // Add to series_followers
    const { data, error } = await supabase
      .from("series_followers")
      .insert({
        user_id: user.id,
        series_id: Number.parseInt(series_id),
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "You are already following this series" }, { status: 409 })
      }
      console.error("[v0] Error following series:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in follow series:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
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
    const series_id = searchParams.get("series_id")

    if (!series_id) {
      return NextResponse.json({ error: "Series ID is required" }, { status: 400 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    if (useContabo) {
      await unfollowSeriesInContabo(user.id, Number.parseInt(series_id))
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase
      .from("series_followers")
      .delete()
      .eq("user_id", user.id)
      .eq("series_id", Number.parseInt(series_id))

    if (error) {
      console.error("[v0] Error unfollowing series:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in unfollow series:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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
      const data = await fetchFollowedSeriesFromContabo(user.id)
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from("series_followers")
      .select(`
        id,
        series_id,
        created_at,
        movies (
          id,
          title,
          poster_url,
          rating,
          total_seasons
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching followed series:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[v0] Error in GET followed series:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
