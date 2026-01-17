"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, ExternalLink, HardDrive, Lock } from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"

interface DownloadLink {
  id: number
  quality: string
  format: string
  link_url: string
  provider: string
  file_size: string
}

interface DownloadSectionProps {
  movieId: number
  episodeId?: number | null
  movieTitle: string
  episodeInfo?: string
}

export function DownloadSection({ movieId, episodeId, movieTitle, episodeInfo }: DownloadSectionProps) {
  const [downloads, setDownloads] = useState<DownloadLink[]>([])
  const [loading, setLoading] = useState(true)
  const { data: session, status } = useSession()
  const user = session?.user || null
  const isCheckingAuth = status === "loading"

  useEffect(() => {
    async function fetchDownloadLinks() {
      setLoading(true)
      try {
        const url = episodeId
          ? `/api/download-links/${movieId}?episodeId=${episodeId}`
          : `/api/download-links/${movieId}`

        console.log(`[DownloadSection] Fetching download links from: ${url}`)
        const response = await fetch(url)
        if (response.ok) {
          const result = await response.json()
          console.log(`[DownloadSection] Received ${result.data?.length || 0} download links`)
          setDownloads(result.data || [])
        } else {
          console.error(`[DownloadSection] Failed to fetch download links: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        console.error("[v0] Error fetching download links:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDownloadLinks()
  }, [movieId, episodeId])

  if (loading || isCheckingAuth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Links
          </CardTitle>
          <CardDescription>Loading download options...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (downloads.length === 0) {
    return null // Don't show the section if no downloads are available
  }

  if (!user) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download {movieTitle}
          </CardTitle>
          <CardDescription>
            {episodeInfo ? `Download ${episodeInfo} in various qualities` : "Download this movie in various qualities"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Sign in to Download</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                You need to be logged in to access download links. Please sign in or create a free account to continue.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/auth/login">
                <Button variant="default">Sign In</Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button variant="outline">Sign Up</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const downloadsByQuality = downloads.reduce(
    (acc, link) => {
      if (!acc[link.quality]) {
        acc[link.quality] = []
      }
      acc[link.quality].push(link)
      return acc
    },
    {} as Record<string, DownloadLink[]>,
  )

  const qualityOrder = ["4K", "1080p", "720p", "480p", "360p"]
  const sortedQualities = Object.keys(downloadsByQuality).sort(
    (a, b) => qualityOrder.indexOf(a) - qualityOrder.indexOf(b),
  )

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download {movieTitle}
        </CardTitle>
        <CardDescription>
          {episodeInfo ? `Download ${episodeInfo} in various qualities` : "Download this movie in various qualities"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedQualities.map((quality) => (
          <div key={quality} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{quality}</h3>
            <div className="grid gap-2">
              {downloadsByQuality[quality].map((link) => (
                <a key={link.id} href={link.link_url} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" className="w-full justify-between gap-2 h-auto py-3 bg-transparent">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">
                          {link.format} - {link.quality}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {link.provider && `${link.provider} ??? `}
                          {link.file_size || "Size unknown"}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

