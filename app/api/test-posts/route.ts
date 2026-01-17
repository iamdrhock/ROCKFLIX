import { NextResponse } from "next/server"
import { queryContabo } from "@/lib/database/contabo-pool"

export async function GET() {
  try {
    console.log("[TEST] Checking posts...")
    
    // Simple test: get ANY posts
    const result = await queryContabo<any>(
      `SELECT id, user_id, content, likes_count, comments_count, created_at 
       FROM posts 
       ORDER BY created_at DESC 
       LIMIT 10`
    )
    
    return NextResponse.json({
      success: true,
      postCount: result.rows?.length || 0,
      posts: result.rows || [],
      message: `Found ${result.rows?.length || 0} posts`
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      postCount: 0,
      posts: []
    }, { status: 500 })
  }
}

