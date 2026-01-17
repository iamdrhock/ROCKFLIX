"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

interface WatchlistButtonProps {
  movieId: number
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export function WatchlistButton({
  movieId,
  variant = "outline",
  size = "default",
  className = "",
}: WatchlistButtonProps) {
  const router = useRouter()
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === "loading") return

    if (session?.user) {
      checkWatchlistStatus()
    } else {
      setIsInWatchlist(false)
      setIsLoading(false)
    }
  }, [movieId, session, status])

  async function checkWatchlistStatus() {
    try {
      const response = await fetch(`/api/watchlist/${movieId}`)
      if (response.ok) {
        const data = await response.json()
        setIsInWatchlist(data.inWatchlist)
      }
    } catch (error) {
      console.error("[v0] Error checking watchlist:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleWatchlist() {
    if (!session?.user) {
      router.push("/auth/login")
      return
    }

    setIsUpdating(true)
    try {
      if (isInWatchlist) {
        const response = await fetch(`/api/watchlist/${movieId}`, {
          method: "DELETE",
        })
        if (response.ok) {
          setIsInWatchlist(false)
        }
      } else {
        const response = await fetch(`/api/watchlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movie_id: movieId }),
        })
        if (response.ok) {
          setIsInWatchlist(true)
        } else {
          const error = await response.json()
          if (error.error) {
            alert(error.error)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error toggling watchlist:", error)
      alert("Failed to update watchlist")
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Bookmark className="h-5 w-5 mr-2" />
        Loading...
      </Button>
    )
  }

  return (
    <Button variant={variant} size={size} onClick={toggleWatchlist} disabled={isUpdating} className={className}>
      {isInWatchlist ? (
        <>
          <BookmarkCheck className="h-5 w-5 mr-2" />
          In Watchlist
        </>
      ) : (
        <>
          <Bookmark className="h-5 w-5 mr-2" />
          Add to Watchlist
        </>
      )}
    </Button>
  )
}

