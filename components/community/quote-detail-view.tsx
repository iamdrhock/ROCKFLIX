"use client"

import { useEffect, useState } from "react"
import { QuotedPostCard } from "./quoted-post-card"
import { PostThread } from "./post-thread"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"

interface QuoteDetailViewProps {
  repostId: string
}

export function QuoteDetailView({ repostId }: QuoteDetailViewProps) {
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuote = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Fetching quote:", repostId)

      const response = await fetch(`/api/community/quote/${repostId}`)

      if (!response.ok) {
        setError("Quote not found")
        setLoading(false)
        return
      }

      const quoteData = await response.json()
      console.log("[v0] Quote data:", quoteData)

      setQuote(quoteData)
      setLoading(false)
    } catch (err) {
      console.error("[v0] Error fetching quote:", err)
      setError("Failed to load quote")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuote()
  }, [repostId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-red-500" />
          <p className="mt-4 text-zinc-400">Loading quote...</p>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-red-500">{error || "Quote not found"}</h2>
          <div className="flex gap-4">
            <Button onClick={fetchQuote} className="bg-red-600 hover:bg-red-700">
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

      <QuotedPostCard post={quote} onUpdate={fetchQuote} />

      <div className="mt-6">
        <PostThread postId={quote.original_post.id} showCloseButton={false} />
      </div>
    </div>
  )
}
