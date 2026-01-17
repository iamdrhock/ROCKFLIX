"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Hash, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Hashtag {
  name: string
  post_count: number
}

export function TrendingHashtags() {
  const [hashtags, setHashtags] = useState<Hashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTrendingHashtags()
  }, [])

  const fetchTrendingHashtags = async () => {
    try {
      setLoading(true)
      setError(false)
      console.log("[v0] Fetching trending hashtags")

      const response = await fetch("/api/community/hashtags/trending")
      if (!response.ok) {
        throw new Error("Failed to fetch hashtags")
      }

      const data = await response.json()
      console.log("[v0] Trending hashtags fetched:", data.hashtags?.length || 0)
      setHashtags(data.hashtags || [])
    } catch (error) {
      console.error("[v0] Error fetching trending hashtags:", error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trending Topics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Failed to load trending topics</p>
            <Button size="sm" variant="outline" onClick={fetchTrendingHashtags}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trending Topics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (hashtags.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {hashtags.map((hashtag) => (
            <Link
              key={hashtag.name}
              href={`/community/hashtag/${hashtag.name}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Hash className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">#{hashtag.name}</p>
                <p className="text-xs text-muted-foreground">
                  {hashtag.post_count} {hashtag.post_count === 1 ? "post" : "posts"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
