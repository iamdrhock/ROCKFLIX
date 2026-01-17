"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageCircle, TrendingUp, Users, Heart } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

// Get community URL directly - hardcoded to fix broken env var issue
// The .env file might have NEXT_PUBLIC_COMMUNITY_URL set incorrectly
const COMMUNITY_URL = "https://talkflix.org"

interface Post {
  id: number
  content: string
  likes_count: number
  comments_count: number
  created_at: string
  image_url?: string
  youtube_url?: string
  profiles: {
    username: string
    profile_picture_url?: string
  } | null
  post_movies?: Array<{
    movies: {
      id: number
      title: string
      poster_url: string
      type: string
    }
  }>
}

export function CommunityPreview() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    console.log("[CommunityPreview] 🚀 Fetching trending posts for homepage")
    setLoading(true)
    
    // Since both ROCKFLIX and TalkFlix share the same Contabo database,
    // we should use the local API route which queries Contabo directly
    // External API is only needed if they have separate databases
    const apiUrl = "/api/community/posts?feed=trending&page=1"
    
    console.log("[CommunityPreview] 📡 Fetching from local API:", apiUrl)
    
    fetch(apiUrl)
      .then((res) => {
        console.log("[CommunityPreview] 📥 API response:", {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
          headers: Object.fromEntries(res.headers.entries())
        })
        
        if (!res.ok) {
          throw new Error(`API returned ${res.status}: ${res.statusText}`)
        }
        return res.json()
      })
      .then((data) => {
        try {
          console.log("[CommunityPreview] 📦 Response data:", {
            hasPosts: !!data?.posts,
            postCount: data?.posts?.length || 0,
            hasMore: data?.hasMore,
          })
          
          if (data && Array.isArray(data.posts) && data.posts.length > 0) {
            // Only set posts if they're valid and have required fields
            const validPosts = data.posts.filter((post: any) => post && post.id && post.content)
            if (validPosts.length > 0) {
              console.log("[CommunityPreview] ✅ Found valid posts, setting state")
              setPosts(validPosts.slice(0, 10))
            } else {
              setPosts([])
            }
          } else {
            setPosts([])
          }
        } catch (parseError: any) {
          console.error("[CommunityPreview] ❌ Error parsing response:", parseError)
          setPosts([])
        } finally {
          setLoading(false)
        }
      })
      .catch((error) => {
        console.error("[CommunityPreview] ❌ Error fetching trending posts:", error)
        setPosts([])
        setLoading(false)
      })
  }, [])

  const renderContentWithHashtags = (content: string) => {
    if (!content) return null

    const parts = content.split(/(#\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith("#")) {
        const hashtag = part.slice(1)
        return (
          <Link
            key={index}
            href={`${COMMUNITY_URL}/community/hashtag/${hashtag}`}
            className="text-primary hover:underline font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Trending on TalkFlix</h2>
            <p className="text-sm text-muted-foreground">See what the community is talking about</p>
          </div>
        </div>
        <Link href={`${COMMUNITY_URL}/community`} target="_self" rel="noopener noreferrer">
          <Button variant="outline">View All Posts</Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Join the conversation!</p>
            <Link href={`${COMMUNITY_URL}/community`} target="_self" rel="noopener noreferrer">
              <Button>
                <MessageCircle className="h-4 w-4 mr-2" />
                Go to TalkFlix
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.filter((post: any) => post && post.id).map((post: any) => {
            const profile = post.profiles || { username: "Anonymous", profile_picture_url: null }

            return (
              <Card
                key={post.id}
                className="h-full hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => window.location.href = `${COMMUNITY_URL}/community/posts/${post.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Link href={`${COMMUNITY_URL}/community/profile/${profile.username}`} onClick={(e) => e.stopPropagation()}>
                      {profile.profile_picture_url ? (
                        <Image
                          src={profile.profile_picture_url || "/placeholder.svg"}
                          alt={profile.username}
                          width={40}
                          height={40}
                          className="rounded-full object-cover hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground hover:opacity-80 transition-opacity">
                          {profile.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`${COMMUNITY_URL}/community/profile/${profile.username}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold hover:underline"
                      >
                        {profile.username}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {post.content && typeof post.content === 'string' && (
                    <p className="text-sm mb-3 line-clamp-3">{renderContentWithHashtags(post.content)}</p>
                  )}

                  {post.post_movies && Array.isArray(post.post_movies) && post.post_movies.length > 0 && post.post_movies[0]?.movies && (
                    <div className="flex items-center gap-2 p-2 mb-3 border rounded-lg bg-muted/30">
                      <Image
                        src={post.post_movies[0].movies.poster_url || "/placeholder.svg"}
                        alt={post.post_movies[0].movies.title}
                        width={32}
                        height={48}
                        className="rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{post.post_movies[0].movies.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{post.post_movies[0].movies.type}</p>
                      </div>
                    </div>
                  )}

                  {post.image_url && typeof post.image_url === 'string' && (
                    <div className="rounded-lg overflow-hidden mb-3">
                      <Image
                        src={post.image_url || "/placeholder.svg"}
                        alt="Post image"
                        width={400}
                        height={200}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      <span>{typeof post.likes_count === 'number' ? post.likes_count : 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{typeof post.comments_count === 'number' ? post.comments_count : 0}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <span className="text-primary font-medium">Trending</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
