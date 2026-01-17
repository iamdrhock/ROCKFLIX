"use client"

import { useState, useEffect } from "react"
import { PostCard } from "./post-card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface HashtagFeedProps {
  hashtag: string
}

export function HashtagFeed({ hashtag }: HashtagFeedProps) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchPosts = async (pageNum: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/community/posts?hashtag=${encodeURIComponent(hashtag)}&page=${pageNum}`)
      const data = await response.json()

      if (pageNum === 1) {
        setPosts(data.posts || [])
      } else {
        setPosts((prev) => [...prev, ...(data.posts || [])])
      }

      setHasMore(data.hasMore)
    } catch (error) {
      console.error("[v0] Error fetching hashtag posts:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts(1)
  }, [hashtag])

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPosts(nextPage)
  }

  if (loading && page === 1) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No posts found with this hashtag yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onUpdate={() => fetchPosts(1)} />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button onClick={loadMore} disabled={loading} variant="outline">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
