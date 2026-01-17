"use client"

import { useEffect, useState } from "react"
import { PostCard } from "./post-card"
import { Bookmark } from "lucide-react"

interface Post {
  id: number
  content: string
  image_url?: string
  youtube_url?: string
  created_at: string
  likes_count: number
  comments_count: number
  repost_count: number
  user_id: string
  profiles: {
    id: string
    username: string
    profile_picture_url?: string
  }
}

interface BookmarkItem {
  id: number
  created_at: string
  post_id: number
  posts: Post
}

export function BookmarkedPosts() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBookmarks()
  }, [])

  async function fetchBookmarks() {
    try {
      setLoading(true)
      const response = await fetch("/api/community/bookmarks")

      if (!response.ok) {
        if (response.status === 401) {
          setError("Please log in to view your bookmarks")
          return
        }
        throw new Error("Failed to fetch bookmarks")
      }

      const data = await response.json()
      setBookmarks(data.bookmarks || [])
    } catch (err) {
      console.error("[v0] Error fetching bookmarks:", err)
      setError("Failed to load bookmarks")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{error}</p>
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12">
        <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg mb-2">No bookmarks yet</p>
        <p className="text-gray-500 text-sm">Save posts to view them here later</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bookmark) => (
        <PostCard
          key={bookmark.id}
          post={{
            ...bookmark.posts,
            profiles: bookmark.posts.profiles,
          }}
        />
      ))}
    </div>
  )
}
