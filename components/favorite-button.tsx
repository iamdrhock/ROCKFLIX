"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

interface FavoriteButtonProps {
  movieId: number
}

export function FavoriteButton({ movieId }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAuthenticated = !!session?.user

  useEffect(() => {
    if (status === "loading") return
    
    if (isAuthenticated) {
      checkFavoriteStatus()
    } else {
      setIsFavorite(false)
    }
  }, [movieId, isAuthenticated, status])

  async function checkFavoriteStatus() {
    try {
      const response = await fetch(`/api/favorites/${movieId}`)
      const data = await response.json()
      setIsFavorite(data.isFavorite)
    } catch (error) {
      console.error("Error checking favorite status:", error)
    }
  }

  async function toggleFavorite() {
    if (!isAuthenticated) {
      router.push("/auth/login")
      return
    }

    setIsLoading(true)

    try {
      if (isFavorite) {
        const response = await fetch(`/api/favorites/${movieId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          setIsFavorite(false)
        }
      } else {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movieId }),
        })

        if (response.ok) {
          setIsFavorite(true)
        }
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={toggleFavorite}
      disabled={isLoading}
      variant={isFavorite ? "default" : "outline"}
      size="lg"
      className="gap-2"
    >
      <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
      {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
    </Button>
  )
}

