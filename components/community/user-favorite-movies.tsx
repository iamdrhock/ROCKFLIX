"use client"

import { useEffect, useState } from "react"
import { Heart, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"

interface Movie {
  id: number
  title: string
  poster_url: string
  release_date: string
  rating: number
}

interface UserFavoriteMoviesProps {
  userId: string
  username: string
}

export function UserFavoriteMovies({ userId, username }: UserFavoriteMoviesProps) {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const response = await fetch(`/api/favorites?userId=${userId}`)

        if (!response.ok) {
          throw new Error("Failed to fetch favorites")
        }

        const data = await response.json()
        setMovies(data.favorites || [])
      } catch (err) {
        console.error("[v0] Error fetching favorites:", err)
        setError("Failed to load favorites")
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [userId])

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
        </div>
      </Card>
    )
  }

  if (error || movies.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-red-500" />
          <h2 className="text-xl font-bold text-white">Favorite Movies</h2>
        </div>
        <p className="text-gray-400 text-center py-8">
          {error ? error : `@${username} hasn't added any favorites yet`}
        </p>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-900 border-gray-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-5 w-5 text-red-500 fill-red-500" />
        <h2 className="text-xl font-bold text-white">Favorite Movies</h2>
        <span className="text-sm text-gray-400">({movies.length})</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {movies.slice(0, 12).map((movie) => (
          <Link
            key={movie.id}
            href={`/watch/${movie.id}`}
            className="group relative aspect-[2/3] rounded-lg overflow-hidden hover:ring-2 hover:ring-red-500 transition-all"
          >
            <Image
              src={movie.poster_url || "/placeholder.svg?height=300&width=200"}
              alt={movie.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-white text-xs font-semibold line-clamp-2">{movie.title}</p>
                {movie.rating && <p className="text-yellow-400 text-xs">★ {movie.rating.toFixed(1)}</p>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {movies.length > 12 && (
        <div className="mt-4 text-center">
          <Link
            href={`/profile/${username}?tab=favorites`}
            className="text-red-500 hover:text-red-400 text-sm font-medium"
          >
            View all {movies.length} favorites →
          </Link>
        </div>
      )}
    </Card>
  )
}
