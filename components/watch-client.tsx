"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import type { Movie, Comment } from "@/lib/api"
import { useSession } from "next-auth/react"
import { FavoriteButton } from "@/components/favorite-button"
import { CustomWatchContent } from "@/components/custom-watch-content"
import { DownloadSection } from "@/components/download-section"
import { trackView, trackPlayerError } from "@/lib/analytics"
import { ChevronLeft, ChevronRight, AlertCircle, AlertTriangle } from "lucide-react"
import { MovieTags } from "@/components/movie-tags"
import { MovieCard } from "@/components/movie-card"
import { useVidifyConfig } from "@/hooks/use-vidify-config"
import { buildVidifyUrl } from "@/lib/vidify-config"
import { Advert } from "@/components/advert"

// Default fallback players (used if API fails)
const DEFAULT_EMBED_PROVIDERS = [
  { id: "vidify", name: "PLAYER 01", url: "https://player.vidify.top/embed" },
  { id: "vidplus", name: "PLAYER 02", url: "https://player.vidplus.to/embed" },
  { id: "vidsrc", name: "PLAYER 03", url: "https://vidsrc-embed.ru" },
  { id: "vidlink", name: "PLAYER 04", url: "https://vidlink.pro" },
  { id: "mapple", name: "PLAYER 05", url: "https://mapple.uk/watch" },
  { id: "primesrc", name: "PLAYER 06", url: "https://primesrc.me/embed" },
  {
    id: "superembed",
    name: "PLAYER 07",
    url: process.env.NEXT_PUBLIC_EMBED_SUPEREMBED || "https://multiembed.mov/directstream.php",
  },
  { id: "autoembed", name: "PLAYER 08", url: "https://player.autoembed.cc/embed" },
  { id: "videasy", name: "PLAYER 09", url: "https://player.videasy.net" },
]

interface Player {
  id: string
  name: string
  displayName: string
  url: string
  order: number
}

interface WatchClientProps {
  movie: Movie
  relatedMovies: Movie[]
  initialComments: Comment[]
  initialSeason?: number
  initialEpisode?: number
}

export function WatchClient({
  movie,
  relatedMovies,
  initialComments,
  initialSeason = 1,
  initialEpisode = 1,
}: WatchClientProps) {
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [selectedPlayer, setSelectedPlayer] = useState(0)
  const [selectedSeason, setSelectedSeason] = useState(initialSeason)
  const [selectedEpisode, setSelectedEpisode] = useState(initialEpisode)
  const [commentText, setCommentText] = useState("")
  const [user, setUser] = useState<any>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewTracked, setViewTracked] = useState(false)
  const [watchStartTime, setWatchStartTime] = useState<number>(Date.now())
  const [iframeError, setIframeError] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [embedProviders, setEmbedProviders] = useState<Player[]>(DEFAULT_EMBED_PROVIDERS.map((p, i) => ({
    id: p.id,
    name: p.name.replace("PLAYER ", ""),
    displayName: p.name,
    url: p.url,
    order: i + 1,
  })))

  // Use NextAuth session
  const { data: session, status } = useSession()

  // Vidify configuration hook - fetches site logo and provides customization
  const { config: vidifyConfig, loading: vidifyConfigLoading } = useVidifyConfig()

  // Fetch player order from API
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const response = await fetch("/api/players")
        if (response.ok) {
          const data = await response.json()
          if (data.players && Array.isArray(data.players) && data.players.length > 0) {
            setEmbedProviders(data.players)
            console.log("[watch-client] Loaded players from API:", data.players)
          }
        }
      } catch (error) {
        console.error("[watch-client] Error fetching players:", error)
        // Keep default providers on error
      }
    }
    fetchPlayers()
  }, [])

  useEffect(() => {
    if (status === "loading") {
      setIsLoadingUser(true)
    } else {
      setUser(session?.user || null)
      setIsLoadingUser(false)
    }
  }, [session, status])

  useEffect(() => {
    if (movie.type === "series") {
      router.replace(`/watch/${movie.id}?season=${selectedSeason}&episode=${selectedEpisode}`, { scroll: false })
    }
  }, [selectedSeason, selectedEpisode, movie.id, movie.type, router])

  useEffect(() => {
    if (!viewTracked) {
      setViewTracked(true)
      setWatchStartTime(Date.now())
      const currentPlayer = embedProviders[selectedPlayer]
      console.log('[watch-client] Tracking view for movie:', movie.id, 'player:', currentPlayer?.displayName || currentPlayer?.name)
      trackView({
        movieId: movie.id,
        playerUsed: currentPlayer?.displayName || currentPlayer?.name || "Unknown",
      }).catch(err => {
        console.error('[watch-client] Error tracking view:', err)
      })
    }
  }, [movie.id, selectedPlayer, viewTracked, embedProviders])

  useEffect(() => {
    const handleBeforeUnload = () => {
      const duration = Math.floor((Date.now() - watchStartTime) / 1000)
      if (duration > 5) {
        // Only track if watched for more than 5 seconds
        const currentPlayer = embedProviders[selectedPlayer]
        trackView({
          movieId: movie.id,
          duration,
          playerUsed: currentPlayer?.displayName || currentPlayer?.name || "Unknown",
        })
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [movie.id, selectedPlayer, watchStartTime, embedProviders])

  useEffect(() => {
    setIframeError(false)
    setIframeLoading(true)

    // Standard timeout for all players - let them load naturally
    const timeoutDuration = 30000 // 30 seconds for all players

    const timeout = setTimeout(() => {
      const currentPlayer = embedProviders[selectedPlayer]
      console.error(`[v0] Iframe loading timeout after ${timeoutDuration / 1000} seconds for ${currentPlayer?.displayName || currentPlayer?.name || "player"}`)
      setIframeLoading(false)
      setIframeError(true)
    }, timeoutDuration)

    return () => {
      clearTimeout(timeout)
    }
  }, [selectedPlayer, selectedSeason, selectedEpisode, vidifyConfig.logourl, vidifyConfigLoading, embedProviders])

  async function loadComments(id: number) {
    try {
      const response = await fetch(`/api/comments/${id}`)
      if (response.ok) {
        const commentsData = await response.json()
        // Ensure commentsData is an array
        if (Array.isArray(commentsData)) {
          setComments(commentsData)
        } else {
          console.warn("[v0] Comments API returned non-array data:", commentsData)
          setComments([])
        }
      } else {
        console.error("[v0] Failed to load comments:", response.status, response.statusText)
        // Don't clear existing comments on error, just log it
      }
    } catch (error: any) {
      console.error("[v0] Error loading comments:", error)
      // Don't throw error, just log it to prevent page crash
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !user) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie_id: movie.id,
          comment: commentText,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setCommentText("")
        // Reload comments after successful submission
        try {
          await loadComments(movie.id)
        } catch (loadError) {
          console.error("[v0] Error reloading comments:", loadError)
          // Don't show error to user, comments will reload on next page refresh
        }

        // Show success message if there's a warning (spam detected)
        if (result.warning) {
          alert(result.warning)
        }
      } else {
        // Try to get error message from response
        let errorMessage = "Failed to post comment"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage
        }
        alert(errorMessage)
      }
    } catch (error: any) {
      console.error("[v0] Error posting comment:", error)
      // Prevent error from propagating and crashing the page
      alert(error?.message || "Failed to post comment. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getEmbedUrl = () => {
    const provider = embedProviders[selectedPlayer]
    if (!provider) {
      console.error("[v0] No provider found at index:", selectedPlayer)
      setIframeError(true)
      return "about:blank"
    }
    const baseUrl = provider.url

    console.log("[v0] Provider:", provider.id)
    console.log("[v0] Movie IMDB ID:", movie.imdb_id)
    console.log("[v0] Movie TMDB ID:", movie.tmdb_id)
    console.log("[v0] Movie type:", movie.type)

    if (!movie.imdb_id && !movie.tmdb_id) {
      console.error("[v0] No IMDB or TMDB ID available for movie:", movie.title)
      setIframeError(true)
      return "about:blank"
    }

    if (provider.id === "vidlink") {
      const tmdbId = movie.tmdb_id || movie.imdb_id

      if (!tmdbId) {
        console.error("[v0] VidLink: No TMDB or IMDB ID available")
        setIframeError(true)
        return "about:blank"
      }

      if (movie.type === "movie") {
        const url = `https://vidlink.pro/movie/${tmdbId}?autoplay=true`
        console.log("[v0] Generated VidLink movie URL:", url)
        return url
      } else {
        const url = `https://vidlink.pro/tv/${tmdbId}/${selectedSeason}/${selectedEpisode}?autoplay=true&nextbutton=true`
        console.log("[v0] Generated VidLink series URL:", url)
        return url
      }
    } else if (provider.id === "vidsrc") {
      if (!movie.imdb_id) {
        console.error("[v0] VidSrc: No IMDB ID available")
        return "about:blank"
      }

      const imdbId = movie.imdb_id.startsWith("tt") ? movie.imdb_id : `tt${movie.imdb_id}`

      if (movie.type === "movie") {
        const url = `${baseUrl}/embed/movie/${imdbId}`
        console.log("[v0] Generated vidsrc movie URL:", url)
        return url
      } else {
        const url = `${baseUrl}/embed/tv/${imdbId}/${selectedSeason}-${selectedEpisode}`
        console.log("[v0] Generated vidsrc series URL:", url)
        return url
      }
    } else if (provider.id === "mapple") {
      const id = movie.tmdb_id || movie.imdb_id

      if (!id) {
        console.error("[v0] Mapple: No TMDB or IMDB ID available")
        return "about:blank"
      }

      if (movie.type === "movie") {
        const url = `https://mapple.uk/watch/movie/${id}?autoPlay=true`
        console.log("[v0] Generated Mapple movie URL:", url)
        return url
      } else {
        const url = `https://mapple.uk/watch/tv/${id}/${selectedSeason}-${selectedEpisode}?autoPlay=true`
        console.log("[v0] Generated Mapple series URL:", url)
        return url
      }
    } else if (provider.id === "primesrc") {
      if (!movie.imdb_id) {
        console.error("[v0] PrimeSrc: No IMDB ID available")
        return "about:blank"
      }

      const imdbId = movie.imdb_id.startsWith("tt") ? movie.imdb_id : `tt${movie.imdb_id}`

      if (movie.type === "movie") {
        const url = `https://primesrc.me/embed/movie?imdb=${imdbId}`
        console.log("[v0] Generated primesrc movie URL:", url)
        return url
      } else {
        const url = `https://primesrc.me/embed/tv?imdb=${imdbId}&season=${selectedSeason}&episode=${selectedEpisode}`
        console.log("[v0] Generated primesrc series URL:", url)
        return url
      }
    } else if (provider.id === "autoembed") {
      if (!movie.imdb_id) {
        console.error("[v0] AutoEmbed: No IMDB ID available")
        return "about:blank"
      }

      const imdbId = movie.imdb_id.startsWith("tt") ? movie.imdb_id : `tt${movie.imdb_id}`

      if (movie.type === "movie") {
        const url = `https://player.autoembed.cc/embed/movie/${imdbId}`
        console.log("[v0] Generated autoembed movie URL:", url)
        return url
      } else {
        const url = `https://player.autoembed.cc/embed/tv/${imdbId}/${selectedSeason}/${selectedEpisode}`
        console.log("[v0] Generated autoembed series URL:", url)
        return url
      }
    } else if (provider.id === "superembed") {
      if (!movie.imdb_id) {
        console.error("[v0] SuperEmbed: No IMDB ID available")
        return "about:blank"
      }

      const imdbId = movie.imdb_id.startsWith("tt") ? movie.imdb_id : `tt${movie.imdb_id}`

      if (movie.type === "movie") {
        const url = `https://multiembed.mov/directstream.php?video_id=${imdbId}`
        console.log("[v0] Generated superembed movie URL:", url)
        return url
      } else {
        const url = `https://multiembed.mov/directstream.php?video_id=${imdbId}&s=${selectedSeason}&e=${selectedEpisode}`
        console.log("[v0] Generated superembed series URL:", url)
        return url
      }
    } else if (provider.id === "vidplus") {
      const tmdbId = movie.tmdb_id || movie.imdb_id

      if (!tmdbId) {
        console.error("[v0] VidPlus: No TMDB or IMDB ID available")
        setIframeError(true)
        return "about:blank"
      }

      if (movie.type === "movie") {
        const url = `https://player.vidplus.to/embed/movie/${tmdbId}?autoplay=true&autoNext=true`
        console.log("[v0] Generated VidPlus movie URL:", url)
        return url
      } else {
        const url = `https://player.vidplus.to/embed/tv/${tmdbId}/${selectedSeason}/${selectedEpisode}?autoplay=true&autoNext=true`
        console.log("[v0] Generated VidPlus series URL:", url)
        return url
      }
    } else if (provider.id === "vidify") {
      const tmdbId = movie.tmdb_id || movie.imdb_id

      if (!tmdbId) {
        console.error("[v0] Vidify: No TMDB or IMDB ID available")
        setIframeError(true)
        return "about:blank"
      }

      // Use Vidify configuration system with actual site logo URL
      // Ensure logo URL is fetched and ready
      if (vidifyConfigLoading) {
        // If still loading config, wait a bit or use fallback
        console.log("[v0] Vidify config still loading, using fallback...")
      }

      const url = buildVidifyUrl(
        tmdbId,
        movie.type === "movie" ? "movie" : "series",
        vidifyConfig, // Uses actual logo URL from settings
        selectedSeason,
        selectedEpisode
      )

      console.log("[v0] Generated Vidify URL:", url)
      console.log("[v0] Vidify config (logo):", vidifyConfig.logourl)
      return url
    } else if (provider.id === "videasy") {
      const tmdbId = movie.tmdb_id || movie.imdb_id

      if (!tmdbId) {
        console.error("[v0] Videasy: No TMDB or IMDB ID available")
        setIframeError(true)
        return "about:blank"
      }

      // Videasy URL format: https://player.videasy.net/movie/movie_id or https://player.videasy.net/tv/show_id/season/episode
      if (movie.type === "movie") {
        const url = `https://player.videasy.net/movie/${tmdbId}`
        console.log("[v0] Generated Videasy movie URL:", url)
        return url
      } else {
        const url = `https://player.videasy.net/tv/${tmdbId}/${selectedSeason}/${selectedEpisode}`
        console.log("[v0] Generated Videasy series URL:", url)
        return url
      }
    } else {
      const id = movie.imdb_id || movie.tmdb_id
      if (!id) {
        console.error("[v0] Generic provider: No ID available")
        return "about:blank"
      }

      if (movie.type === "movie") {
        return `${baseUrl}/${id}`
      } else {
        return `${baseUrl}/${id}/${selectedSeason}/${selectedEpisode}`
      }
    }
  }

  // Make embedUrl reactive to Vidify config changes
  const embedUrl = getEmbedUrl()
  console.log("[v0] Final embed URL:", embedUrl)
  console.log("[v0] Iframe loading state:", iframeLoading)
  console.log("[v0] Vidify config loading:", vidifyConfigLoading)
  console.log("[v0] Vidify logo URL:", vidifyConfig.logourl)
  console.log("[v0] Iframe error state:", iframeError)

  // Reset loading state if URL is about:blank (error case)
  useEffect(() => {
    if (embedUrl === "about:blank") {
      console.warn("[v0] Embed URL is about:blank, setting error state")
      setIframeError(true)
      setIframeLoading(false)
    }
  }, [embedUrl])

  const seasons = movie.seasons?.map((s) => s.season_number).sort((a, b) => a - b) || []

  const currentSeason = movie.seasons?.find((s) => s.season_number === selectedSeason)
  const currentSeasonEpisodes = currentSeason?.episodes || []
  const currentEpisode = currentSeasonEpisodes.find((ep) => ep.episode_number === selectedEpisode)
  const currentEpisodeIndex = currentSeasonEpisodes.findIndex((ep) => ep.episode_number === selectedEpisode)
  const hasPrevEpisode = currentEpisodeIndex > 0
  const hasNextEpisode = currentEpisodeIndex < currentSeasonEpisodes.length - 1

  const goToPrevEpisode = () => {
    if (hasPrevEpisode) {
      setSelectedEpisode(currentSeasonEpisodes[currentEpisodeIndex - 1].episode_number)
    }
  }

  const goToNextEpisode = () => {
    if (hasNextEpisode) {
      setSelectedEpisode(currentSeasonEpisodes[currentEpisodeIndex + 1].episode_number)
    }
  }

  const getShareUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.href
    }
    return ""
  }

  const getShareText = () => {
    if (movie.type === "series") {
      return `Check out ${movie.title} - Season ${selectedSeason} Episode ${selectedEpisode}`
    }
    return `Check out ${movie.title}`
  }

  const handleShare = (platform: string) => {
    const url = encodeURIComponent(getShareUrl())
    const text = encodeURIComponent(getShareText())

    let shareUrl = ""

    switch (platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
        break
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`
        break
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${text}%20${url}`
        break
      case "telegram":
        shareUrl = `https://t.me/share/url?url=${url}&text=${text}`
        break
      case "reddit":
        shareUrl = `https://www.reddit.com/submit?url=${url}&title=${text}`
        break
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=400")
    }
  }

  return (
    <>
      {/* Video Player - Load immediately */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
        {iframeError && embedUrl === "about:blank" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Player Unavailable</h3>
                <p className="text-sm text-gray-400 mb-4">
                  This player is not available for this content. Please try another player.
                </p>
                <Button
                  onClick={() => {
                    setIframeError(false)
                    const nextPlayer = (selectedPlayer + 1) % embedProviders.length
                    setSelectedPlayer(nextPlayer)
                  }}
                  variant="outline"
                  size="sm"
                >
                  Try Next Player
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm">Loading player...</p>
                </div>
              </div>
            )}

            <iframe
              key={`${selectedPlayer}-${embedUrl}`}
              src={embedUrl}
              className="w-full h-full border-0"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              loading="eager"
              title={`${movie.title} - ${embedProviders[selectedPlayer]?.displayName || embedProviders[selectedPlayer]?.name || "Player"}`}
              onLoad={() => {
                console.log("[v0] Player loaded successfully, URL:", embedUrl)
                setIframeLoading(false)
                setIframeError(false)
              }}
              onError={(e) => {
                console.error("[v0] Player error detected:", e)
                setIframeError(true)
                setIframeLoading(false)
                trackPlayerError({
                  movieId: movie.id,
                  playerUsed: embedProviders[selectedPlayer]?.displayName || embedProviders[selectedPlayer]?.name || "Unknown",
                  errorType: "loading_failed",
                  errorMessage: "Failed to load player iframe",
                })
              }}
            />
          </>
        )}
      </div>

      {movie.type === "series" && currentEpisode && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">
            {currentEpisode.title || `Episode ${selectedEpisode}`} (S{selectedSeason}-E{selectedEpisode})
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevEpisode}
              disabled={!hasPrevEpisode}
              className="gap-2 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
              PREV EPISODE
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextEpisode}
              disabled={!hasNextEpisode}
              className="gap-2 bg-transparent"
            >
              NEXT EPISODE
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Player Selection */}
      <div className="flex flex-wrap gap-2 mb-6">
        {embedProviders.map((provider, index) => (
          <Button
            key={provider.id}
            variant={selectedPlayer === index ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPlayer(index)}
            className={selectedPlayer === index ? "bg-primary text-primary-foreground" : ""}
          >
            {provider.displayName}
          </Button>
        ))}
      </div>

      <CustomWatchContent />

      {/* Advertisement */}
      <div className="mb-6">
        <Advert position="watch" className="w-full" />
      </div>

      {/* Download Section */}
      <DownloadSection
        movieId={movie.id}
        episodeId={movie.type === "series" && currentEpisode ? currentEpisode.id : null}
        movieTitle={movie.title}
        episodeInfo={
          movie.type === "series" && currentEpisode ? `Season ${selectedSeason} Episode ${selectedEpisode}` : undefined
        }
      />

      {/* Episode Selection for Series */}
      {movie.type === "series" && movie.seasons && movie.seasons.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Season Selection */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Select Season</h3>
            <div className="flex flex-wrap gap-2">
              {seasons.map((seasonNum) => (
                <Button
                  key={seasonNum}
                  variant={selectedSeason === seasonNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedSeason(seasonNum)
                    setSelectedEpisode(1)
                  }}
                  className={selectedSeason === seasonNum ? "bg-primary text-primary-foreground" : ""}
                >
                  Season {seasonNum}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Episodes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {currentSeasonEpisodes.map((episode) => (
                <button
                  key={episode.id}
                  onClick={() => setSelectedEpisode(episode.episode_number)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${selectedEpisode === episode.episode_number
                      ? "border-primary ring-2 ring-primary/50"
                      : "border-border hover:border-primary/50"
                    }`}
                >
                  <Image
                    src={
                      (movie.backdrop_url?.startsWith("/uploads/") ? movie.backdrop_url.replace("/uploads/", "/api/images/") : movie.backdrop_url) ||
                      (movie.poster_url?.startsWith("/uploads/") ? movie.poster_url.replace("/uploads/", "/api/images/") : movie.poster_url) ||
                      `/placeholder.svg?height=90&width=160&query=Episode ${episode.episode_number || "/placeholder.svg"}`
                    }
                    alt={episode.title || `Episode ${episode.episode_number}`}
                    fill
                    className="object-cover"
                    unoptimized={true}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-xs font-semibold text-white line-clamp-1">
                      {episode.episode_number}. {episode.title || `Episode ${episode.episode_number}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Movie Poster Thumbnail */}
      <div className="mb-6">
        <div className="relative w-full max-w-xs aspect-video rounded-lg overflow-hidden bg-muted">
          <Image
            src={
              (movie.backdrop_url?.startsWith("/uploads/") ? movie.backdrop_url.replace("/uploads/", "/api/images/") : movie.backdrop_url) ||
              (movie.poster_url?.startsWith("/uploads/") ? movie.poster_url.replace("/uploads/", "/api/images/") : movie.poster_url) ||
              `/placeholder.svg?height=200&width=350&query=${encodeURIComponent(movie.title) || "/placeholder.svg"}`
            }
            alt={movie.title}
            fill
            className="object-cover"
            unoptimized={true}
          />
        </div>
      </div>

      {/* Share With Friend Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3">Share this with your friends:</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Share this {movie.type === "series" ? "series" : "movie"} with your friends on social media
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => handleShare("facebook")}
            className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Share on Facebook"
          >
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </button>
          <button
            onClick={() => handleShare("twitter")}
            className="w-10 h-10 rounded-full bg-black flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Share on X (Twitter)"
          >
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </button>
          <button
            onClick={() => handleShare("whatsapp")}
            className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Share on WhatsApp"
          >
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </button>
          <button
            onClick={() => handleShare("telegram")}
            className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Share on Telegram"
          >
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .687-.561 1.248-1.25 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.248.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
          </button>
          <button
            onClick={() => handleShare("reddit")}
            className="w-10 h-10 rounded-full bg-[#FF4500] flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Share on Reddit"
          >
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .687-.561 1.248-1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Movie Tags */}
      {movie.tags && movie.tags.length > 0 && <MovieTags tags={movie.tags} className="mb-6" />}

      {/* Report Issue Section */}
      <div className="mb-6 p-4 border border-border rounded-lg bg-muted/50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Movie not playing? Not downloading?</p>
            <a
              href={`mailto:rockflixonline@gmail.com?subject=Report Issue: ${encodeURIComponent(movie.title)}${movie.type === "series" ? ` - S${selectedSeason}E${selectedEpisode}` : ""}&body=Movie/Series: ${encodeURIComponent(movie.title)}%0D%0AType: ${movie.type}${movie.type === "series" ? `%0D%0ASeason: ${selectedSeason}%0D%0AEpisode: ${selectedEpisode}` : ""}%0D%0APlayer Used: ${embedProviders[selectedPlayer]?.displayName || embedProviders[selectedPlayer]?.name || "Unknown"}%0D%0A%0D%0APlease describe the issue:%0D%0A`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <AlertCircle className="h-4 w-4" />
              Report this issue
            </a>
          </div>
        </div>
      </div>

      {/* Reactions Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3">Add to Your Favorites</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Mark this {movie.type === "series" ? "series" : "movie"} as a favorite to showcase it on your public profile
        </p>
        <FavoriteButton movieId={movie.id} size="lg" />
      </div>

      {/* Comments Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Comments ({comments.length})</h2>

        {/* Comment Form */}
        {isLoadingUser ? (
          <div className="mb-4">Loading user...</div>
        ) : (
          <form onSubmit={handleCommentSubmit} className="mb-4">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="w-full p-2 border rounded mb-2"
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map((comment: any) => {
            // Handle both 'user' and 'profiles' formats for compatibility
            const userName = comment.user?.name || comment.profiles?.username || comment.user_name || 'User'
            const userAvatar = comment.user?.avatar_url || comment.profiles?.profile_picture_url || null
            const commentText = comment.comment || comment.comment_text || ''

            return (
              <div key={comment.id} className="flex items-start gap-3">
                <Image
                  src={userAvatar || "/placeholder.svg"}
                  alt={userName}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div>
                  <p className="font-semibold">{userName}</p>
                  <p className="text-sm text-muted-foreground">{commentText}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* You May Also Like Section */}
      {relatedMovies && relatedMovies.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {relatedMovies.map((relatedMovie) => (
              <MovieCard key={relatedMovie.id} movie={relatedMovie} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
