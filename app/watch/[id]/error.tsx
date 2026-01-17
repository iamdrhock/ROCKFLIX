"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, Home, RefreshCw } from "lucide-react"

export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Watch page error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Unable to Load Video</h1>
          <p className="text-muted-foreground">
            We encountered an error while trying to load this content. This could be due to:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>The video source is temporarily unavailable</li>
            <li>Your internet connection was interrupted</li>
            <li>The content may have been removed</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline" className="gap-2 w-full sm:w-auto bg-transparent">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
        </div>

        {error.digest && <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>}
      </div>
    </div>
  )
}
