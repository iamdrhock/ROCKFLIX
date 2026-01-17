"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard } from "./post-card"
import { QuotedPostCard } from "./quoted-post-card"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Post {
  id: number
  user_id: string
  content: string
  youtube_url?: string
  image_url?: string
  likes_count: number
  comments_count: number
  created_at: string
  isLiked: boolean
  hashtags?: string[]
  profiles: {
    id: string
    username: string
    profile_picture_url?: string
  }
  type?: string // Add type field to Post interface
}

export function CommunityFeed() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("for-you")
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = async (feed: string, pageNum = 1, hashtag: string | null = null) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        feed,
        page: pageNum.toString(),
      })

      if (hashtag) {
        params.append("hashtag", hashtag)
      }

      console.log("[v0] Fetching posts:", { feed, pageNum, hashtag })
      const response = await fetch(`/api/community/posts?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("[v0] Posts fetched:", data.posts?.length || 0)

      if (pageNum === 1) {
        setPosts(data.posts || [])
      } else {
        setPosts((prev) => [...prev, ...(data.posts || [])])
      }
      setHasMore(data.hasMore)
    } catch (error) {
      console.error("[v0] Error fetching posts:", error)
      setError(error instanceof Error ? error.message : "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const hashtag = searchParams.get("hashtag")
    const username = searchParams.get("user")

    if (username) {
      router.push(`/community/profile/${username}`)
      return
    }

    setActiveHashtag(hashtag)
    setPage(1)
    fetchPosts(activeTab, 1, hashtag)
  }, [searchParams, router])

  useEffect(() => {
    setPage(1)
    fetchPosts(activeTab, 1, activeHashtag)
  }, [activeTab])

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPosts(activeTab, nextPage, activeHashtag)
  }

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev])
  }

  const retryFetch = () => {
    setError(null)
    setPage(1)
    fetchPosts(activeTab, 1, activeHashtag)
  }

  return (
    <div className="space-y-6">
      {activeHashtag && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <p className="text-sm">
            Showing posts for <span className="font-bold text-primary">#{activeHashtag}</span>
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={retryFetch}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="for-you">For You</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>

        <TabsContent value="for-you" className="mt-6 space-y-4">
          {loading && page === 1 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeHashtag
                  ? `No posts found for #${activeHashtag}`
                  : "No posts yet. Be the first to share something!"}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => {
                if (post.type === "quote") {
                  return (
                    <QuotedPostCard
                      key={post.id}
                      post={post}
                      onUpdate={() => fetchPosts(activeTab, 1, activeHashtag)}
                    />
                  )
                }
                return <PostCard key={post.id} post={post} onUpdate={() => fetchPosts(activeTab, 1, activeHashtag)} />
              })}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button onClick={loadMore} variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Show More
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="trending" className="mt-6 space-y-4">
          {loading && page === 1 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeHashtag ? `No trending posts found for #${activeHashtag}` : "No trending posts yet."}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => {
                if (post.type === "quote") {
                  return (
                    <QuotedPostCard
                      key={post.id}
                      post={post}
                      onUpdate={() => fetchPosts(activeTab, 1, activeHashtag)}
                    />
                  )
                }
                return <PostCard key={post.id} post={post} onUpdate={() => fetchPosts(activeTab, 1, activeHashtag)} />
              })}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button onClick={loadMore} variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Show More
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="following" className="mt-6 space-y-4">
          {loading && page === 1 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeHashtag
                  ? `No posts found for #${activeHashtag} from users you follow`
                  : "Follow other users to see their posts here."}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => {
                if (post.type === "quote") {
                  return (
                    <QuotedPostCard
                      key={post.id}
                      post={post}
                      onUpdate={() => fetchPosts(activeTab, 1, activeHashtag)}
                    />
                  )
                }
                return <PostCard key={post.id} post={post} onUpdate={() => fetchPosts(activeTab, 1, activeHashtag)} />
              })}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button onClick={loadMore} variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Show More
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
