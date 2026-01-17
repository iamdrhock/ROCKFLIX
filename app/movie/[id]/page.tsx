import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MovieCard } from "@/components/movie-card"
import { fetchMovie, fetchMovies, type Movie } from "@/lib/api"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Play, Calendar, Clock, Star, Globe, Film } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { WatchlistButton } from "@/components/watchlist-button"
import { Advert } from "@/components/advert"

interface MoviePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  try {
    const { id } = await params
    const movie = await fetchMovie(Number.parseInt(id))

    // Use Contabo if enabled
    let settings: any = null
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
        settings = await fetchSiteSettingsFromContabo()
      } catch (contaboError) {
        console.error("[movie] Error fetching settings from Contabo, falling back to Supabase:", contaboError)
        // Fall through to Supabase fallback
      }
    }
    
    // Fallback to Supabase if Contabo failed or not enabled
    if (!settings) {
      try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data } = await supabase
          .from("site_settings")
          .select("site_title, meta_movie_detail_title, site_logo_url")
          .single()
        settings = data
      } catch (supabaseError) {
        console.error("[movie] Error fetching settings from Supabase:", supabaseError)
      }
    }
    const siteName = settings?.site_title || "M4UHDTV"
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

    if (!movie) {
      return {
        title: `Movie Not Found - ${siteName}`,
      }
    }

    const title =
      settings?.meta_movie_detail_title?.replace(/{title}/g, movie.title).replace(/{site_name}/g, siteName) ||
      `${movie.title} | Watch/Download Full Movie HD Free - ${siteName}`

    const description =
      movie.description ||
      `Watch ${movie.title} online in HD quality for free. ${movie.rating ? `IMDB: ${movie.rating}/10` : ""}`

    const movieUrl = `${siteUrl}/movie/${movie.id}`
    const posterUrl = movie.poster_url || `${siteUrl}/placeholder.svg`

    return {
      title,
      description,
      keywords: `${movie.title}, watch ${movie.title}, ${movie.title} free, ${movie.genres || ""}, ${movie.director || ""}`,
      authors: [{ name: siteName }],
      openGraph: {
        title,
        description,
        url: movieUrl,
        siteName,
        images: [
          {
            url: posterUrl,
            width: 300,
            height: 450,
            alt: movie.title,
          },
        ],
        type: "video.movie",
        releaseDate: movie.release_date,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [posterUrl],
      },
      alternates: {
        canonical: movieUrl,
      },
    }
  } catch (error) {
    console.error("[v0] Error generating movie metadata:", error)
    return {
      title: "Movie - Watch HD Free",
      description: "Watch movies online in HD quality for free",
    }
  }
}

export default async function MoviePage({ params }: MoviePageProps) {
  try {
    const { id } = await params
    const movie = await fetchMovie(Number.parseInt(id))

    if (!movie) {
      notFound()
    }

    // Fetch similar movies (same type) with error handling
    let similarMovies: Movie[] = []
    try {
      const similarMoviesResult = await fetchMovies(movie.type, 6)
      similarMovies = similarMoviesResult?.movies || []
    } catch (error) {
      console.error("[MoviePage] Error fetching similar movies:", error)
      similarMovies = []
    }
    const filteredSimilar = similarMovies.filter((m) => m.id !== movie.id).slice(0, 5)

  console.log(`[MoviePage] Movie ${movie.id} (${movie.title}):`, {
    genres: movie.genres,
    genresType: typeof movie.genres,
    actorsCount: movie.actors?.length || 0,
    actors: movie.actors?.slice(0, 3).map((a: any) => a.name) || []
  })

  const toSlug = (text: string) => text.toLowerCase().replace(/\s+/g, "-")

  const genreList: string[] = (() => {
    if (typeof movie.genres === "string") {
      return movie.genres.split(",").map((g) => g.trim()).filter(Boolean)
    }
    if (Array.isArray(movie.genres)) {
      return (movie.genres as any[]).map((g: any) => (typeof g === 'object' && g.name ? g.name : String(g)))
    }
    return []
  })()
  
  console.log(`[MoviePage] Genre list after processing:`, genreList)

  const countryList =
    typeof movie.country === "string"
      ? movie.country
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : []

  const structuredData: any = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title || "",
    description: movie.description || "",
    image: movie.poster_url || "",
    ...(movie.release_date && { datePublished: movie.release_date }),
    ...(movie.director && {
      director: {
        "@type": "Person",
        name: movie.director,
      },
    }),
    ...(genreList.length > 0 && { genre: genreList }),
    ...(countryList.length > 0 && { countryOfOrigin: countryList[0] }),
    ...(movie.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: movie.rating,
        bestRating: 10,
        ratingCount: movie.views || 1,
      },
    }),
    ...(movie.actors && movie.actors.length > 0 && {
      actor: movie.actors
        .map((actor) => ({
          "@type": "Person",
          name: actor.name || "",
          ...(actor.character_name ? { character: actor.character_name } : {}),
        }))
        .filter((actor) => actor.name),
    }),
    ...(movie.runtime && { duration: `PT${movie.runtime}M` }),
  }

  return (
    <div className="min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <Header />

      <main className="flex-1">
        {/* Hero Section with Backdrop */}
        <div className="relative w-full h-[300px] md:h-[400px] pointer-events-none">
          <Image
            src={
              (movie.backdrop_url?.startsWith("/uploads/") ? movie.backdrop_url.replace("/uploads/", "/api/images/") : movie.backdrop_url) ||
              (movie.poster_url?.startsWith("/uploads/") ? movie.poster_url.replace("/uploads/", "/api/images/") : movie.poster_url) ||
              `/placeholder.svg?height=400&width=1200&query=${encodeURIComponent(movie.title) || "/placeholder.svg"}`
            }
            alt={movie.title}
            fill
            className="object-cover"
            priority
            unoptimized={true}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
        </div>

        <div className="container px-4 -mt-32 relative z-20 pointer-events-auto">
          {/* Movie Poster */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Movie Poster */}
            <div className="flex-shrink-0">
              <div className="relative w-[200px] md:w-[250px] aspect-[2/3] rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src={
                    (movie.poster_url?.startsWith("/uploads/") ? movie.poster_url.replace("/uploads/", "/api/images/") : movie.poster_url) || `/placeholder.svg?height=450&width=300&query=${encodeURIComponent(movie.title)}`
                  }
                  alt={movie.title}
                  fill
                  className="object-cover"
                  priority
                  unoptimized={true}
                />
              </div>
            </div>

            {/* Movie Info */}
            <div className="flex-1 space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-balance">{movie.title}</h1>

              <div className="relative z-10 flex flex-wrap gap-3">
                <Link
                  href={`/watch/${movie.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  <Play className="h-5 w-5" />
                  WATCH NOW
                </Link>
              </div>

              {/* Movie Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground font-medium min-w-[100px]">Genre:</span>
                  <span className="text-foreground">
                    {genreList.length > 0
                      ? genreList.map((genre: string, index: number) => (
                          <span key={genre}>
                            <Link
                              href={`/genre/${toSlug(genre)}`}
                              className="text-primary underline hover:text-primary/80 transition-colors"
                            >
                              {genre}
                            </Link>
                            {index < genreList.length - 1 && ", "}
                          </span>
                        ))
                      : "N/A"}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground font-medium min-w-[100px]">Director:</span>
                  <span className="text-foreground">{movie.director || "N/A"}</span>
                </div>

                {movie.actors && movie.actors.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground font-medium min-w-[100px]">Actors:</span>
                    <span className="text-foreground">
                      {movie.actors.map((actor, index) => (
                        <span key={actor.id}>
                          <Link
                            href={`/actor/${actor.id}`}
                            className="text-primary underline hover:text-primary/80 transition-colors"
                          >
                            {actor.name}
                          </Link>
                          {index < (movie.actors?.length || 0) - 1 && ", "}
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Duration:</span>
                  <span className="text-foreground">{movie.runtime ? `${movie.runtime} min` : "N/A"}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Release:</span>
                  <span className="text-foreground">
                    {movie.release_date ? (
                      <Link
                        href={`/year/${new Date(movie.release_date).getFullYear()}`}
                        className="text-primary underline hover:text-primary/80 transition-colors"
                      >
                        {new Date(movie.release_date).getFullYear()}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Country:</span>
                  <span className="text-foreground">
                    {countryList.length > 0
                      ? countryList.map((country, index) => (
                          <span key={country}>
                            <Link
                              href={`/country/${toSlug(country)}`}
                              className="text-primary underline hover:text-primary/80 transition-colors"
                            >
                              {country}
                            </Link>
                            {index < countryList.length - 1 && ", "}
                          </span>
                        ))
                      : "N/A"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Production:</span>
                  <span className="text-foreground">{movie.production || "N/A"}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium min-w-[100px]">Quality:</span>
                  <span className="text-primary font-semibold">{movie.quality || "HD"}</span>
                </div>

                {movie.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span className="text-muted-foreground font-medium">IMDB:</span>
                    <span className="text-foreground font-semibold">{movie.rating}/10</span>
                  </div>
                )}
              </div>

              {/* Watchlist Button */}
              <div className="pt-4">
                <WatchlistButton movieId={movie.id} size="default" />
              </div>

              {/* Description */}
              {movie.description && (
                <div className="pt-4">
                  <h2 className="text-lg font-semibold mb-2">Synopsis</h2>
                  <p className="text-muted-foreground leading-relaxed text-pretty">{movie.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Advertisement */}
          <div className="mt-8">
            <Advert position="detail" className="w-full" />
          </div>

          {/* Trailer Section */}
          {movie.trailer_url && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Trailer</h2>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={movie.trailer_url}
                  title={`${movie.title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </section>
          )}

          {/* Cast Section */}
          {movie.actors && movie.actors.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Casts</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {movie.actors.slice(0, 6).map((actor) => (
                  <Link key={actor.id} href={`/actor/${actor.id}`} className="flex flex-col gap-2 group">
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={
                          (actor.photo_url?.startsWith("/uploads/") ? actor.photo_url.replace("/uploads/", "/api/images/") : actor.photo_url) ||
                          `/placeholder.svg?height=300&width=200&query=${encodeURIComponent(actor.name) || "/placeholder.svg"}`
                        }
                        alt={actor.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 20vw"
                        unoptimized={true}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {actor.name}
                      </p>
                      {actor.character_name && (
                        <p className="text-xs text-muted-foreground line-clamp-1">as {actor.character_name}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Similar Movies Section */}
          {filteredSimilar.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Something similar</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredSimilar.map((similarMovie) => (
                  <MovieCard key={similarMovie.id} movie={similarMovie} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
    )
  } catch (error) {
    console.error("[MoviePage] Critical error:", error)
    throw error // This will be caught by error.tsx
  }
}
