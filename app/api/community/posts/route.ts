import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { extractHashtags } from "@/lib/hashtags"
import { sanitizeHtml, isValidUrl } from "@/lib/security/validation"
import { rateLimiters } from "@/lib/security/rate-limit"
import { checkRequestSize } from "@/lib/security/request-limits"
import type { NextRequest } from "next/server"
import { fetchPostsFromContabo } from "@/lib/database/contabo-queries"
import { createPostInContabo } from "@/lib/database/contabo-writes"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const feed = searchParams.get("feed") || "for-you"
    const hashtag = searchParams.get("hashtag")
    const username = searchParams.get("username")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = 30

    console.log("[api/community/posts] 🚀 GET request:", { feed, hashtag, username, page })

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        // Get user for authentication (optional for trending feed)
        let userId = null
        try {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id || null
        } catch (authError: any) {
          console.log("[api/community/posts] ⚠️ Auth error (continuing without user):", authError?.message)
          // Continue without user for trending feed
        }
        
        console.log("[api/community/posts] 🔍 Fetching from Contabo:", {
          feed,
          page,
          limit,
          hasUserId: !!userId,
        })
        
        const result = await fetchPostsFromContabo({
          feed,
          hashtag: hashtag || null,
          username: username || null,
          page,
          limit,
          userId,
        })
        
        console.log("[api/community/posts] ✅ Success:", {
          postCount: result?.posts?.length || 0,
          hasMore: result?.hasMore || false,
        })
        
        // Always return valid response, even if empty
        // Add debug info if no posts found
        if (!result?.posts || result.posts.length === 0) {
          console.log("[api/community/posts] ⚠️ No posts returned from Contabo query")
          // Check if posts exist in database
          try {
            const { queryContabo } = await import("@/lib/database/contabo-pool")
            const countResult = await queryContabo<{ count: string }>('SELECT COUNT(*) as count FROM posts')
            const totalPosts = parseInt(countResult.rows[0]?.count || '0', 10)
            console.log("[api/community/posts] 🔍 Database check: Total posts in database:", totalPosts)
            
            if (totalPosts > 0) {
              // Get a sample post to see structure
              const sampleResult = await queryContabo<any>(
                'SELECT id, user_id, content, likes_count, comments_count, created_at FROM posts ORDER BY created_at DESC LIMIT 1'
              )
              console.log("[api/community/posts] 📋 Sample post:", sampleResult.rows[0] || null)
            }
          } catch (debugError: any) {
            console.error("[api/community/posts] ❌ Debug query error:", debugError.message)
          }
        }
        
        return NextResponse.json({
          posts: result?.posts || [],
          hasMore: result?.hasMore || false,
        })
      } catch (contaboError: any) {
        console.error("[api/community/posts] ❌ Contabo error (returning empty):", {
          message: contaboError?.message,
          code: contaboError?.code,
          name: contaboError?.name,
        })
        // Return empty array instead of throwing
        return NextResponse.json({
          posts: [],
          hasMore: false,
        })
      }
    }

    // Fallback to Supabase (shouldn't reach here if USE_CONTABO_DB is true)
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const offset = (page - 1) * limit
      let query = supabase
        .from("posts")
        .select("*, post_likes(user_id), post_movies(movies(id, title, poster_url, type))")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (username) {
        const { data: userProfile } = await supabase.from("profiles").select("id").eq("username", username).single()

        if (userProfile) {
          query = query.eq("user_id", userProfile.id)
        } else {
          return NextResponse.json({ posts: [], hasMore: false })
        }
      } else if (hashtag) {
        const { data: hashtagData } = await supabase
          .from("hashtags")
          .select("id")
          .eq("name", hashtag.toLowerCase())
          .single()

        if (hashtagData) {
          const { data: postHashtagsData } = await supabase
            .from("post_hashtags")
            .select("post_id")
            .eq("hashtag_id", hashtagData.id)

          const postIds = postHashtagsData?.map((ph) => ph.post_id) || []

          if (postIds.length > 0) {
            query = query.in("id", postIds)
          } else {
            return NextResponse.json({ posts: [], hasMore: false })
          }
        } else {
          return NextResponse.json({ posts: [], hasMore: false })
        }
      } else if (feed === "for-you" && user) {
        const { data: likedPosts } = await supabase
          .from("post_likes")
          .select("posts(user_id)")
          .eq("user_id", user.id)
          .limit(100)

        const { data: commentedPosts } = await supabase
          .from("post_comments")
          .select("posts(user_id)")
          .eq("user_id", user.id)
          .limit(100)

        const engagedUserIds = new Set<string>()
        likedPosts?.forEach((like: any) => {
          if (like.posts?.user_id) engagedUserIds.add(like.posts.user_id)
        })
        commentedPosts?.forEach((comment: any) => {
          if (comment.posts?.user_id) engagedUserIds.add(comment.posts.user_id)
        })

        const { data: engagedHashtagPosts } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .limit(50)

        const engagedPostIds = engagedHashtagPosts?.map((p: any) => p.post_id) || []

        let engagedHashtagIds: number[] = []
        if (engagedPostIds.length > 0) {
          const { data: postHashtags } = await supabase
            .from("post_hashtags")
            .select("hashtag_id")
            .in("post_id", engagedPostIds)

          engagedHashtagIds = [...new Set(postHashtags?.map((ph: any) => ph.hashtag_id) || [])]
        }

        let hashtagPostIds: number[] = []
        if (engagedHashtagIds.length > 0) {
          const { data: hashtagPosts } = await supabase
            .from("post_hashtags")
            .select("post_id")
            .in("hashtag_id", engagedHashtagIds)

          hashtagPostIds = hashtagPosts?.map((ph: any) => ph.post_id) || []
        }

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const { data: trendingPosts } = await supabase
          .from("posts")
          .select("id")
          .gte("created_at", yesterday.toISOString())
          .gte("likes_count", 2)
          .order("likes_count", { ascending: false })
          .limit(20)

        const trendingPostIds = trendingPosts?.map((p: any) => p.id) || []

        const sixHoursAgo = new Date()
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6)

        const { data: latestPosts } = await supabase
          .from("posts")
          .select("id")
          .gte("created_at", sixHoursAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(30)

        const latestPostIds = latestPosts?.map((p: any) => p.id) || []

        const personalizedPostIds = new Set([...hashtagPostIds, ...trendingPostIds, ...latestPostIds])
        const engagedUserIdArray = Array.from(engagedUserIds)

        if (engagedUserIdArray.length > 0 || personalizedPostIds.size > 0) {
          const finalQuery = supabase
            .from("posts")
            .select("*, post_likes(user_id), post_movies(movies(id, title, poster_url, type))")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

          if (personalizedPostIds.size > 0) {
            const allRelevantPostIds = Array.from(personalizedPostIds)
            query = supabase
              .from("posts")
              .select("*, post_likes(user_id), post_movies(movies(id, title, poster_url, type))")
              .or(`user_id.in.(${engagedUserIdArray.join(",")}),id.in.(${allRelevantPostIds.join(",")})`)
              .order("created_at", { ascending: false })
              .range(offset, offset + limit - 1)
          } else if (engagedUserIdArray.length > 0) {
            query = query.in("user_id", engagedUserIdArray)
          }
        } else {
          const twelveHoursAgo = new Date()
          twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12)

          query = query.gte("created_at", twelveHoursAgo.toISOString()).order("created_at", { ascending: false })
        }
      } else if (feed === "following" && user) {
        const { data: followingData } = await supabase
          .from("user_follows")
          .select("following_id")
          .eq("follower_id", user.id)

        const followingIds = followingData?.map((f) => f.following_id) || []

        if (followingIds.length > 0) {
          query = query.in("user_id", followingIds)
        } else {
          return NextResponse.json({ posts: [], hasMore: false })
        }
      } else if (feed === "trending") {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        query = supabase
          .from("posts")
          .select("*, post_likes(user_id), post_movies(movies(id, title, poster_url, type))")
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("likes_count", { ascending: false })
          .order("comments_count", { ascending: false })
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)

        console.log("[v0] Trending query configured for last 7 days")
      }

      const { data: posts, error } = await query

      if (error) {
        console.error("[v0] Error fetching posts:", error)
        throw error
      }

      console.log("[v0] Posts fetched:", posts?.length || 0)

      let repostQuery = supabase
        .from("post_reposts")
        .select("*, posts!post_reposts_post_id_fkey(*, post_movies(movies(id, title, poster_url, type)))")
        .order("created_at", { ascending: false })
        .range(0, Math.floor(limit / 2))

      if (username) {
        const { data: userProfile } = await supabase.from("profiles").select("id").eq("username", username).single()
        if (userProfile) {
          repostQuery = repostQuery.eq("user_id", userProfile.id)
        }
      }

      const { data: reposts } = hashtag ? { data: null } : await repostQuery

      if (posts && posts.length > 0) {
        const userIds = [...new Set(posts.map((post: any) => post.user_id))]

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, profile_picture_url")
          .in("id", userIds)

        const profileMap = new Map()
        profiles?.forEach((profile: any) => {
          profileMap.set(profile.id, profile)
        })

        if (reposts && reposts.length > 0) {
          const reposterIds = [...new Set(reposts.map((repost: any) => repost.user_id))]
          const { data: reposterProfiles } = await supabase
            .from("profiles")
            .select("id, username, profile_picture_url")
            .in("id", reposterIds)

          reposterProfiles?.forEach((profile: any) => {
            if (!profileMap.has(profile.id)) {
              profileMap.set(profile.id, profile)
            }
          })
        }

        const postIds = posts.map((post: any) => post.id)
        const { data: postHashtagsData } = await supabase
          .from("post_hashtags")
          .select("post_id, hashtags(name)")
          .in("post_id", postIds)

        const hashtagsMap = new Map()
        postHashtagsData?.forEach((ph: any) => {
          if (!hashtagsMap.has(ph.post_id)) {
            hashtagsMap.set(ph.post_id, [])
          }
          hashtagsMap.get(ph.post_id).push(ph.hashtags.name)
        })

        const postsWithData = posts
          .filter((post: any) => {
            if (hashtag) {
              return post.content && post.content.trim().length > 0
            }
            return true
          })
          .map((post: any) => ({
            ...post,
            profiles: profileMap.get(post.user_id) || null,
            isLiked: user ? post.post_likes?.some((like: any) => like.user_id === user.id) : false,
            hashtags: hashtagsMap.get(post.id) || [],
            post_likes: undefined,
            type: "post",
          }))

        const repostsWithData = (reposts || [])
          .filter((repost: any) => repost.quote_content)
          .map((repost: any) => {
            const originalPost = repost.posts
            if (!originalPost) return null

            return {
              id: `repost-${repost.id}`,
              repost_id: repost.id,
              quote_content: repost.quote_content,
              created_at: repost.created_at,
              profiles: profileMap.get(repost.user_id) || null,
              original_post: {
                ...originalPost,
                profiles: profileMap.get(originalPost.user_id) || null,
              },
              type: "quote",
              likes_count: 0,
              comments_count: 0,
              repost_count: 0,
            }
          })
          .filter((item: any) => item !== null)

        const allItems = [...postsWithData, ...repostsWithData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )

        return NextResponse.json({
          posts: allItems.slice(0, limit),
          hasMore: posts.length === limit,
        })
      }

      return NextResponse.json({
        posts: [],
        hasMore: false,
      })
    } catch (supabaseError: any) {
      console.error("[api/community/posts] ❌ Supabase fallback error (returning empty):", {
        message: supabaseError?.message || 'Unknown error',
        code: supabaseError?.code,
        name: supabaseError?.name,
      })
      // Return empty array instead of throwing
      return NextResponse.json({
        posts: [],
        hasMore: false,
      })
    }
  } catch (error: any) {
    console.error("[api/community/posts] ❌ Fatal error (returning empty):", {
      message: error?.message || 'Unknown error',
      code: error?.code,
      name: error?.name,
    })
    // Always return empty array instead of 500 error
    return NextResponse.json({
      posts: [],
      hasMore: false,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check request size
    const sizeCheck = checkRequestSize(request)
    if (!sizeCheck.valid) {
      return sizeCheck.response!
    }

    // Rate limiting per user
    const rateLimitResult = rateLimiters.posts(request, user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "You're posting too quickly. Please wait a moment.",
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    const { content, youtube_url, image_url, movie_id } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(content.trim())
    
    if (!sanitizedContent || sanitizedContent.length === 0) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 })
    }

    if (sanitizedContent.length > 500) {
      return NextResponse.json({ error: "Content must be 500 characters or less" }, { status: 400 })
    }

    // Validate URLs if provided
    if (youtube_url && !isValidUrl(youtube_url)) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 })
    }

    if (image_url && !isValidUrl(image_url)) {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 })
    }

    const urlPattern = /(?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/gi
    if (urlPattern.test(sanitizedContent)) {
      return NextResponse.json({ error: "Links are not allowed in posts" }, { status: 400 })
    }

    const hashtags = extractHashtags(sanitizedContent)

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[v0] Using Contabo to create post")
      const post = await createPostInContabo({
        user_id: user.id,
        content: sanitizedContent,
        youtube_url: youtube_url || null,
        image_url: image_url || null,
        movie_id: movie_id || null,
        hashtags: hashtags,
      })
      return NextResponse.json({ post })
    }

    // Fallback to Supabase
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content: sanitizedContent,
        youtube_url,
        image_url,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[v0] Error creating post:", error)
      throw error
    }

    if (movie_id && post) {
      const { error: movieError } = await supabase.from("post_movies").insert({
        post_id: post.id,
        movie_id: movie_id,
      })

      if (movieError) {
        console.error("[v0] Error linking movie to post:", movieError)
      }
    }

    if (hashtags.length > 0 && post) {
      for (const tag of hashtags) {
        const { data: hashtagData, error: hashtagError } = await supabase
          .from("hashtags")
          .upsert({ name: tag }, { onConflict: "name" })
          .select("id")
          .single()

        if (hashtagData) {
          await supabase.from("post_hashtags").insert({
            post_id: post.id,
            hashtag_id: hashtagData.id,
          })
        }
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url")
      .eq("id", user.id)
      .single()

    const postWithProfile = {
      ...post,
      profiles: profile,
      isLiked: false,
      hashtags: hashtags,
      post_likes: undefined,
    }

    return NextResponse.json({ post: postWithProfile })
  } catch (error) {
    console.error("Error creating post:", error)
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
  }
}
