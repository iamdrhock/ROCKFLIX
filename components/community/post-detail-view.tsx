"use client"

import { useEffect, useState } from "react"
import { PostCard } from "./post-card"
import { PostThread } from "./post-thread"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"

interface PostDetailViewProps {
  postId: string
}

export function PostDetailView({ postId }: PostDetailViewProps) {
  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPost = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Fetching post:", postId)

      // Use API route instead of direct Supabase call
      const response = await fetch(`/api/community/posts/${postId}`)
      
      if (!response.ok) {
        console.error("[v0] Post fetch error:", response.status, response.statusText)
        setError("Post not found")
        setLoading(false)
        return
      }

      const postData = await response.json()
      console.log("[v0] Post data:", postData)

      setPost(postData)
      setLoading(false)
    } catch (err) {
      console.error("[v0] Error fetching post:", err)
      setError("Failed to load post")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPost()
  }, [postId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-red-500" />
          <p className="mt-4 text-zinc-400">Loading post...</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-red-500">{error || "Post not found"}</h2>
          <div className="flex gap-4">
            <Button onClick={fetchPost} className="bg-red-600 hover:bg-red-700">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Link href="/community">
              <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-900 bg-transparent">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to TalkFlix
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link href="/community">
        <Button variant="ghost" className="mb-6 text-white hover:bg-zinc-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to TalkFlix
        </Button>
      </Link>

      <PostCard post={post} />

      <div className="mt-6">
        <PostThread postId={Number.parseInt(postId)} showCloseButton={false} />
      </div>
    </div>
  )
}
