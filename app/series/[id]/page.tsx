import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MovieCard } from "@/components/movie-card"
import { fetchMovie, fetchMovies } from "@/lib/api"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Play, Calendar, Star, Globe, Film } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { WatchlistButton } from "@/components/watchlist-button"
import { Advert } from "@/components/advert"

interface SeriesPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  try {
    const { id } = await params
    const series = await fetchMovie(Number.parseInt(id))

    // Use Contabo if enabled
    let settings: any = null
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
        settings = await fetchSiteSettingsFromContabo()
      } catch (contaboError) {
        console.error("[series] Error fetching settings from Contabo, falling back to Supabase:", contaboError)
        // Fall through to Supabase fallback
      }
    }
    
    // Fallback to Supabase if Contabo failed or not enabled
    if (!settings) {
      try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data } = await supabase
          .from("site_settings")
          .select("site_title, meta_series_detail_title")
          .single()
        settings = data
      } catch (supabaseError) {
        console.error("[series] Error fetching settings from Supabase:", supabaseError)
      }
    }
    const siteName = settings?.site_title || "M4UHDTV"
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

    if (!series || series.type !== "series") {
      return {
        title: `Series Not Found - ${siteName}`,
      }
    }

    const title =
      settings?.meta_series_detail_title?.replace(/{title}/g, series.title).replace(/{site_name}/g, siteName) ||
      `${series.title} | Watch/Download Full Seasons HD Free - ${siteName}`

    const description =
      series.description ||
      `Watch ${series.title} all seasons online in HD quality for free. ${series.rating ? `IMDB: ${series.rating}/10` : ""}`

    const seriesUrl = `${siteUrl}/series/${series.id}`
    const posterUrl = series.poster_url || `${siteUrl}/placeholder.svg`

    return {
      title,
      description,
      keywords: `${series.title}, watch ${series.title}, ${series.title} free, ${series.genres || ""}, TV series`,
      authors: [{ name: siteName }],
      openGraph: {
        title,
        description,
        url: seriesUrl,
        siteName,
        images: [
          {
            url: posterUrl,
            width: 300,
            height: 450,
            alt: series.title,
          },
        ],
        type: "video.tv_show",
        releaseDate: series.release_date,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [posterUrl],
      },
      alternates: {
        canonical: seriesUrl,
      },
    }
  } catch (error) {
    console.error("[v0] Error generating series metadata:", error)
    return {
      title: "Series - Watch HD Free",
      description: "Watch TV series online in HD quality for free",
    }
  }
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { id } = await params
  const series = await fetchMovie(Number.parseInt(id))

  if (!series || series.type !== "series") {
    notFound()
  }

  // Fetch similar series
  const similarSeriesResult = await fetchMovies("series", 6)
  const similarSeries = similarSeriesResult.movies || []
  const filteredSimilar = similarSeries.filter((s) => s.id !== series.id).slice(0, 5)

  const toSlug = (text: string) => text.toLowerCase().replace(/\s+/g, "-")

  const genreList =
    typeof series.genres === "string"
      ? series.genres
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : Array.isArray(series.genres)
        ? series.genres.map((g: any) => g.name)
        : []

  const countryList =
    typeof series.country === "string"
      ? series.country
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : []

  const structuredData: any = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: series.title || "",
    description: series.description || "",
    image: series.poster_url || "",
    ...(series.release_date && { datePublished: series.release_date }),
    ...(series.director && {
      director: {
        "@type": "Person",
        name: series.director,
      },
    }),
    ...(genreList.length > 0 && { genre: genreList }),
    ...(countryList.length > 0 && { countryOfOrigin: countryList[0] }),
    ...((series.seasons?.length || series.total_seasons) && {
      numberOfSeasons: series.seasons?.length || series.total_seasons,
    }),
    ...(series.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: series.rating,
        bestRating: 10,
        ratingCount: series.views || 1,
      },
    }),
    ...(series.actors && series.actors.length > 0 && {
      actor: series.actors
        .map((actor) => ({
          "@type": "Person",
          name: actor.name || "",
        }))
        .filter((actor) => actor.name),
    }),
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
              (series.backdrop_url?.startsWith("/uploads/") ? series.backdrop_url.replace("/uploads/", "/api/images/") : series.backdrop_url) ||
              (series.poster_url?.startsWith("/uploads/") ? series.poster_url.replace("/uploads/", "/api/images/") : series.poster_url) ||
              `/placeholder.svg?height=400&width=1200&query=${encodeURIComponent(series.title) || "/placeholder.svg"}`
            }
            alt={series.title}
            fill
            className="object-cover"
            priority
            unoptimized={true}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20 z-0" />
        </div>

        <div className="container px-4 -mt-32 relative z-20 pointer-events-auto">
          {/* Series Poster */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Series Poster */}
            <div className="flex-shrink-0">
              <div className="relative w-[200px] md:w-[250px] aspect-[2/3] rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src={
                    (series.poster_url?.startsWith("/uploads/") ? series.poster_url.replace("/uploads/", "/api/images/") : series.poster_url) ||
                    `/placeholder.svg?height=450&width=300&query=${encodeURIComponent(series.title) || "/placeholder.svg"}`
                  }
                  alt={series.title}
                  fill
                  className="object-cover"
                  priority
                  unoptimized={true}
                />
              </div>
            </div>

            {/* Series Info */}
            <div className="flex-1 space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-balance">{series.title}</h1>

              <div className="relative z-10 flex flex-wrap gap-3">
                <Link
                  href={`/watch/${series.id}?season=1&episode=1`}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  <Play className="h-5 w-5" />
                  WATCH NOW
                </Link>
              </div>

              {/* Series Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground font-medium min-w-[100px]">Genre:</span>
                  <span className="text-foreground">
                    {genreList.length > 0
                      ? genreList.map((genre, index) => (
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
                  <span className="text-foreground">{series.director || "N/A"}</span>
                </div>

                {series.actors && series.actors.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground font-medium min-w-[100px]">Actors:</span>
                    <span className="text-foreground">
                      {series.actors.map((actor, index) => (
                        <span key={actor.id}>
                          <Link
                            href={`/actor/${actor.id}`}
                            className="text-primary underline hover:text-primary/80 transition-colors"
                          >
                            {actor.name}
                          </Link>
                          {index < series.actors.length - 1 && ", "}
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-medium">Release:</span>
                  <span className="text-foreground">
                    {series.release_date ? (
                      <Link
                        href={`/year/${new Date(series.release_date).getFullYear()}`}
                        className="text-primary underline hover:text-primary/80 transition-colors"
                      >
                        {new Date(series.release_date).getFullYear()}
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
                  <span className="text-foreground">{series.production || "N/A"}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium min-w-[100px]">Quality:</span>
                  <span className="text-primary font-semibold">{series.quality || "HD"}</span>
                </div>

                {series.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span className="text-muted-foreground font-medium">IMDB:</span>
                    <span className="text-foreground font-semibold">{series.rating}/10</span>
                  </div>
                )}
              </div>

              {/* Watchlist Button just above Synopsis section */}
              <div className="pt-2">
                <WatchlistButton movieId={series.id} size="default" />
              </div>

              {/* Description */}
              {series.description && (
                <div className="pt-4">
                  <h2 className="text-lg font-semibold mb-2">Synopsis</h2>
                  <p className="text-muted-foreground leading-relaxed text-pretty">{series.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Advertisement */}
          <div className="mt-8">
            <Advert position="detail" className="w-full" />
          </div>

          {/* Seasons Section */}
          {series.seasons && series.seasons.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Seasons</h2>
              <Accordion type="single" collapsible defaultValue="season-1" className="w-full space-y-4">
                {series.seasons.map((season) => (
                  <AccordionItem
                    key={season.id}
                    value={`season-${season.season_number}`}
                    className="border rounded-lg bg-card"
                  >
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-24 rounded overflow-hidden bg-muted flex-shrink-0">
                          <Image
                            src={
                              (series.poster_url?.startsWith("/uploads/") ? series.poster_url.replace("/uploads/", "/api/images/") : series.poster_url) ||
                              `/placeholder.svg?height=96&width=64&query=Season ${season.season_number || "/placeholder.svg"}`
                            }
                            alt={`Season ${season.season_number}`}
                            fill
                            className="object-cover"
                            unoptimized={true}
                          />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-semibold">Season {season.season_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {season.episodes?.length || season.episode_count} Episodes
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="grid gap-3 mt-2">
                        {season.episodes &&
                          season.episodes.map((episode) => (
                            <Link
                              key={episode.id}
                              href={`/watch/${series.id}?season=${season.season_number}&episode=${episode.episode_number}`}
                              className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent transition-colors group"
                            >
                              <div className="relative w-32 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                                <Image
                                  src={
                                    (series.backdrop_url?.startsWith("/uploads/") ? series.backdrop_url.replace("/uploads/", "/api/images/") : series.backdrop_url) ||
                                    (series.poster_url?.startsWith("/uploads/") ? series.poster_url.replace("/uploads/", "/api/images/") : series.poster_url) ||
                                    `/placeholder.svg?height=80&width=128&query=Episode ${episode.episode_number || "/placeholder.svg"}`
                                  }
                                  alt={episode.title || `Episode ${episode.episode_number}`}
                                  fill
                                  className="object-cover transition-transform group-hover:scale-105"
                                  sizes="(max-width: 768px) 50vw, 20vw"
                                  unoptimized={true}
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="h-8 w-8 text-white" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-primary">
                                    Episode {episode.episode_number}
                                  </span>
                                </div>
                                <h4 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                                  {episode.title || `Episode ${episode.episode_number}`}
                                </h4>
                              </div>
                            </Link>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}

          {/* Trailer Section */}
          {series.trailer_url && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Trailer</h2>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={series.trailer_url}
                  title={`${series.title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </section>
          )}

          {/* Cast Section */}
          {series.actors && series.actors.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Casts</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {series.actors.slice(0, 6).map((actor) => (
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
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Related Series Section */}
          {filteredSimilar.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Related Series</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredSimilar.map((similarSeries) => (
                  <MovieCard key={similarSeries.id} movie={similarSeries} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
