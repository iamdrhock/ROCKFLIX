import { notFound } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { fetchMovie, fetchComments, fetchSimilarMovies } from "@/lib/api"
import { WatchClient } from "@/components/watch-client"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { CustomWatchContentMiddle } from "@/components/custom-watch-content-middle"
import { VidPlusPreconnect } from "@/components/vidplus-preconnect"
import { Suspense } from "react"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params
    const movieId = Number.parseInt(id, 10)

    if (Number.isNaN(movieId) || movieId <= 0) {
      return {
        title: "Watch - Stream HD",
        description: "Watch movies and TV shows in HD quality",
      }
    }

    const movie = await fetchMovie(movieId)
    
    // Use Contabo if enabled
    let settings: any = null
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
        settings = await fetchSiteSettingsFromContabo()
      } catch (contaboError) {
        console.error("[watch] Error fetching settings from Contabo, falling back to Supabase:", contaboError)
        // Fall through to Supabase fallback
      }
    }
    
    // Fallback to Supabase if Contabo failed or not enabled
    if (!settings) {
      try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data } = await supabase
          .from("site_settings")
          .select("site_title, site_logo_url, meta_movie_watch_title, meta_series_watch_title")
          .single()
        settings = data
      } catch (supabaseError) {
        console.error("[watch] Error fetching settings from Supabase:", supabaseError)
      }
    }

    const siteName = settings?.site_title || "M4UHDTV"
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

    if (!movie) {
      return {
        title: `Watch - ${siteName}`,
        description: "Watch movies and TV shows in HD quality",
      }
    }

    const titlePattern =
      movie.type === "series"
        ? settings?.meta_series_watch_title || "Watch {title} Online Free HD - {site_name}"
        : settings?.meta_movie_watch_title || "Watch {title} Online Free HD - {site_name}"

    const title = titlePattern.replace("{title}", movie.title).replace("{site_name}", siteName)

    const description = movie.description
      ? `${movie.description.substring(0, 155)}...`
      : `Watch ${movie.title} online in HD quality. Stream full ${movie.type === "series" ? "series" : "movie"} free on ${siteName}.`
    const watchUrl = `${siteUrl}/watch/${movie.id}`
    const posterUrl = movie.poster_url || `${siteUrl}/placeholder.svg`

    return {
      title,
      description,
      keywords: `watch ${movie.title}, ${movie.title} online, stream ${movie.title}, ${movie.title} free, ${movie.genres || ""}`,
      openGraph: {
        title,
        description,
        url: watchUrl,
        siteName,
        images: [
          {
            url: posterUrl,
            width: 1200,
            height: 630,
            alt: movie.title,
          },
        ],
        type: "video.other",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [posterUrl],
      },
      alternates: {
        canonical: watchUrl,
      },
      robots: {
        index: true,
        follow: true,
      },
      other: {
        // Preconnect hints for VidPlus and ad networks
        'link-preconnect': 'https://player.vidplus.to',
        'link-dns-prefetch': 'https://player.vidplus.to',
      },
    }
  } catch (error) {
    console.error("[v0] Error generating watch page metadata:", error)
    return {
      title: "Watch - Stream HD",
      description: "Watch movies and TV shows in HD quality",
    }
  }
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ season?: string; episode?: string }>
}) {
  try {
    const { id } = await params
    const { season, episode } = await searchParams
    const movieId = Number.parseInt(id, 10)

    console.log("[v0] Watch page loading for ID:", movieId)

    if (Number.isNaN(movieId) || movieId <= 0) {
      console.log("[v0] Invalid movie ID, showing 404")
      notFound()
    }

    // Fetch all data in parallel to speed up page load
    const [movie, relatedMovies, commentsResult] = await Promise.allSettled([
      fetchMovie(movieId),
      fetchSimilarMovies(movieId, 5),
      fetchComments(movieId).catch((error) => {
        console.error("[v0] Error fetching comments for watch page:", error)
        return []
      }),
    ])

    // Handle movie fetch result
    if (movie.status === "rejected" || !movie.value) {
      console.log("[v0] Movie not found, showing 404")
      notFound()
    }

    const movieData = movie.value

    if (!movieData.imdb_id && !movieData.tmdb_id) {
      console.error("[v0] Movie missing both IMDB and TMDB IDs:", movieData.title)
      // Still show the page, but the WatchClient will handle the error gracefully
    }

    console.log("[v0] Movie loaded successfully:", movieData.title)

    // Handle related movies and comments
    const relatedMoviesData = relatedMovies.status === "fulfilled" ? relatedMovies.value : []
    const comments = commentsResult.status === "fulfilled" ? commentsResult.value : []

    // Parse season and episode from URL
    const initialSeason = season ? Number.parseInt(season, 10) : 1
    const initialEpisode = episode ? Number.parseInt(episode, 10) : 1

    return (
      <div className="min-h-screen flex flex-col">
        {/* Inject preconnect hints immediately for VidPlus */}
        <VidPlusPreconnect />
        <Suspense fallback={<div className="h-20 bg-background border-b" />}>
          <Header />
        </Suspense>
        <main className="flex-1">
          <div className="container px-4 py-6">
            <Link href={movieData.type === "series" ? `/series/${movieData.id}` : `/movie/${movieData.id}`}>
              <Button variant="outline" size="sm" className="mb-4 gap-2 bg-transparent">
                <ArrowLeft className="h-4 w-4" />
                Back to {movieData.type === "series" ? "series" : "movie"} details
              </Button>
            </Link>

            <Suspense fallback={null}>
              <CustomWatchContentMiddle />
            </Suspense>

            <h1 className="text-2xl md:text-3xl font-bold mb-4 text-balance">{movieData.title}</h1>

            {/* Render player immediately - don't wait for Header or other components */}
            <WatchClient
              movie={movieData}
              relatedMovies={relatedMoviesData}
              initialComments={comments}
              initialSeason={initialSeason}
              initialEpisode={initialEpisode}
            />
          </div>
        </main>
        <Footer />
      </div>
    )
  } catch (error) {
    console.error("[v0] Critical error in watch page:", error)
    throw error // This will be caught by error.tsx
  }
}
