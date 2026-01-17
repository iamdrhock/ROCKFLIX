import { NextResponse } from "next/server"
import { queryContabo } from "@/lib/database/contabo-pool"

export async function GET() {
  try {
    console.log("[DEBUG] Checking posts in database...")
    
    // Check if USE_CONTABO_DB is enabled
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    
    if (!useContabo) {
      return NextResponse.json({
        success: false,
        error: "USE_CONTABO_DB is not enabled",
        useContabo: false,
        postCount: 0,
        latestPosts: []
      })
    }
    
    // Simple query to count posts
    const countResult = await queryContabo<{ count: string }>(
      'SELECT COUNT(*) as count FROM posts'
    )
    const postCount = parseInt(countResult.rows[0]?.count || '0', 10)
    
    // Get latest 10 posts with full details
    const postsResult = await queryContabo<any>(
      `SELECT 
        id, 
        user_id, 
        content, 
        likes_count, 
        comments_count, 
        created_at,
        image_url,
        youtube_url
       FROM posts 
       ORDER BY created_at DESC 
       LIMIT 10`
    )
    
    // Check if profiles exist for these posts
    let postsWithProfiles = postsResult.rows || []
    if (postsWithProfiles.length > 0) {
      const userIds = [...new Set(postsWithProfiles.map((p: any) => p.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        try {
          const profilesResult = await queryContabo<any>(
            `SELECT id, username, profile_picture_url FROM profiles WHERE id = ANY($1::uuid[])`,
            [userIds]
          )
          const profileMap = new Map(profilesResult.rows.map((p: any) => [p.id, p]))
          postsWithProfiles = postsWithProfiles.map((post: any) => ({
            ...post,
            profile: profileMap.get(post.user_id) || null
          }))
        } catch (profileError: any) {
          console.error("[DEBUG] Error fetching profiles:", profileError.message)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      useContabo,
      postCount,
      latestPosts: postsWithProfiles,
      message: postCount > 0 
        ? `Found ${postCount} posts in database` 
        : 'No posts found in database - this is why TalkFlix section is empty!'
    })
  } catch (error: any) {
    console.error("[DEBUG] Error checking posts:", error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      postCount: 0,
      latestPosts: []
    }, { status: 500 })
  }
}

