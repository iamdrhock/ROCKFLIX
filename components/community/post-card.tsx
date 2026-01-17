"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, MessageCircle, Repeat, Bookmark } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { PostThread } from "./post-thread"
import { RepostDialog } from "./repost-dialog" // Import RepostDialog component
import { useRouter } from "next/navigation"

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
  post_movies?: Array<{
    movies: {
      id: number
      title: string
      poster_url: string
      type: string
    }
  }>
  repost_count?: number // Optional repost count
}

interface PostCardProps {
  post: Post
  onUpdate: () => void
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [isLiking, setIsLiking] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [showRepostDialog, setShowRepostDialog] = useState(false)
  const [isReposted, setIsReposted] = useState(false)
  const [repostCount, setRepostCount] = useState(post.repost_count || 0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check")
        setIsLoggedIn(response.ok)
      } catch (error) {
        setIsLoggedIn(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    const checkRepostStatus = async () => {
      try {
        const response = await fetch(`/api/community/posts/${post.id}/repost`)
        const data = await response.json()
        setIsReposted(data.isReposted)
      } catch (error) {
        console.error("Error checking repost status:", error)
      }
    }
    checkRepostStatus()
  }, [post.id, isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    const checkBookmarkStatus = async () => {
      try {
        const response = await fetch(`/api/community/bookmarks/check?postId=${post.id}`)
        if (response.ok) {
          const data = await response.json()
          setIsBookmarked(data.isBookmarked)
        }
      } catch (error) {
        console.error("[v0] Error checking bookmark status:", error)
      }
    }
    checkBookmarkStatus()
  }, [post.id, isLoggedIn])

  const requireAuth = (action: string) => {
    if (!isLoggedIn) {
      if (confirm(`Please log in to ${action} on TalkFlix. Go to login page?`)) {
        router.push("/community/auth/login")
      }
      return false
    }
    return true
  }

  const handleLike = async () => {
    if (!requireAuth("like posts")) return

    setIsLiking(true)

    try {
      const method = isLiked ? "DELETE" : "POST"
      const response = await fetch(`/api/community/posts/${post.id}/like`, { method })

      if (response.ok) {
        setIsLiked(!isLiked)
        setLikesCount(isLiked ? likesCount - 1 : likesCount + 1)
      }
    } catch (error) {
      console.error("Error toggling like:", error)
    } finally {
      setIsLiking(false)
    }
  }

  const handleRepost = () => {
    if (!requireAuth("repost")) return
    setShowRepostDialog(true)
  }

  const handleShowReplies = () => {
    if (!requireAuth("view replies")) return
    setShowReplies(!showReplies)
  }

  const handleRepostComplete = async () => {
    console.log("[v0] Repost completed, refreshing status")
    try {
      const response = await fetch(`/api/community/posts/${post.id}/repost`)
      const data = await response.json()
      setIsReposted(data.isReposted)
      if (data.isReposted && !isReposted) {
        setRepostCount(repostCount + 1)
      }
    } catch (error) {
      console.error("[v0] Error refreshing repost status:", error)
    }
    onUpdate()
  }

  const handleBookmark = async () => {
    if (!requireAuth("bookmark posts")) return

    setIsBookmarking(true)

    try {
      if (isBookmarked) {
        const response = await fetch(`/api/community/bookmarks?postId=${post.id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          setIsBookmarked(false)
        }
      } else {
        const response = await fetch("/api/community/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        })
        if (response.ok) {
          setIsBookmarked(true)
        }
      }
    } catch (error) {
      console.error("[v0] Error toggling bookmark:", error)
    } finally {
      setIsBookmarking(false)
    }
  }

  const handleProfileClick = (e: React.MouseEvent, username: string) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/community/profile/${username}`)
  }

  const handleMovieClick = (e: React.MouseEvent, movieId: number, type: string) => {
    e.preventDefault()
    e.stopPropagation()
    const path = type === "movie" ? `/movie/${movieId}` : `/series/${movieId}`
    router.push(path)
  }

  const getYoutubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1]
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null
  }

  const renderContentWithHashtags = (content: string | undefined) => {
    if (!content) return null
    const parts = content.split(/(#\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith("#")) {
        const hashtag = part.slice(1)
        return (
          <span
            key={index}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              router.push(`/community/hashtag/${hashtag}`)
            }}
            className="text-primary hover:underline font-semibold cursor-pointer"
          >
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  const embedUrl = post.youtube_url ? getYoutubeEmbedUrl(post.youtube_url) : null

  return (
    <>
      <Card>
        <Link href={`/community/posts/${post.id}`} className="block">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div onClick={(e) => handleProfileClick(e, post.profiles.username)} className="shrink-0 cursor-pointer">
                {post.profiles.profile_picture_url ? (
                  <Image
                    src={post.profiles.profile_picture_url || "/placeholder.svg"}
                    alt={post.profiles.username}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {post.profiles.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span
                  onClick={(e) => handleProfileClick(e, post.profiles.username)}
                  className="font-semibold hover:underline cursor-pointer"
                >
                  {post.profiles.username}
                </span>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm">{renderContentWithHashtags(post.content)}</p>

            {post.image_url && (
              <div className="rounded-lg overflow-hidden">
                <Image
                  src={post.image_url || "/placeholder.svg"}
                  alt="Post image"
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover max-h-96"
                />
              </div>
            )}

            {post.post_movies && post.post_movies.length > 0 && (
              <div
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={(e) => handleMovieClick(e, post.post_movies![0].movies.id, post.post_movies![0].movies.type)}
              >
                <Image
                  src={post.post_movies[0].movies.poster_url || "/placeholder.svg"}
                  alt={post.post_movies[0].movies.title}
                  width={48}
                  height={72}
                  className="rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-sm truncate">{post.post_movies[0].movies.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{post.post_movies[0].movies.type}</p>
                </div>
              </div>
            )}

            {embedUrl && (
              <div className="aspect-video w-full overflow-hidden rounded-lg">
                <iframe
                  src={embedUrl}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}
          </CardContent>
        </Link>

        <CardContent className="pt-0">
          <div className="flex items-center gap-6 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ${isLiked ? "text-red-500" : "text-muted-foreground"}`}
              onClick={(e) => {
                e.preventDefault()
                handleLike()
              }}
              disabled={isLiking}
            >
              <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
              <span>{likesCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={(e) => {
                e.preventDefault()
                handleShowReplies()
              }}
            >
              <MessageCircle className="h-4 w-4" />
              <span>{post.comments_count}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ${isReposted ? "text-green-500" : "text-muted-foreground"}`}
              onClick={(e) => {
                e.preventDefault()
                handleRepost()
              }}
            >
              <Repeat className="h-4 w-4" />
              <span>{repostCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ml-auto ${isBookmarked ? "text-red-500" : "text-muted-foreground"}`}
              onClick={(e) => {
                e.preventDefault()
                handleBookmark()
              }}
              disabled={isBookmarking}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showReplies && <PostThread postId={post.id} onClose={() => setShowReplies(false)} />}

      <RepostDialog
        postId={post.id}
        open={showRepostDialog}
        onClose={() => setShowRepostDialog(false)}
        onRepost={handleRepostComplete}
      />
    </>
  )
}
