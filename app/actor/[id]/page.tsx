import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArchiveClient } from "@/components/archive-client"
import { fetchActor, fetchMoviesByActor } from "@/lib/api"
import { notFound } from "next/navigation"
import Image from "next/image"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface ActorPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: ActorPageProps): Promise<Metadata> {
  try {
    const { id } = await params
    const actor = await fetchActor(Number.parseInt(id))

    // Use Contabo if enabled
    let siteName = "M4UHDTV"
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
        const settings = await fetchSiteSettingsFromContabo()
        siteName = settings?.site_title || "M4UHDTV"
      } catch (error) {
        console.error("[ActorPage] Error fetching site settings from Contabo:", error)
      }
    } else {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: settings } = await supabase.from("site_settings").select("site_title").single()
      siteName = settings?.site_title || "M4UHDTV"
    }

    if (!actor) {
      return {
        title: `Actor Not Found - ${siteName}`,
      }
    }

    return {
      title: `${actor.name} - Movies & TV Shows | ${siteName}`,
      description: `Browse all movies and TV shows featuring ${actor.name}. Watch online in HD quality for free.`,
    }
  } catch (error) {
    console.error("[v0] Error generating actor metadata:", error)
    return {
      title: "Actor - Watch HD Free",
      description: "Browse movies and TV shows by actor",
    }
  }
}

export default async function ActorPage({ params, searchParams }: ActorPageProps) {
  const { id } = await params
  const params_obj = await searchParams
  const actorId = Number.parseInt(id)
  const currentPage = Number.parseInt(params_obj.page || "1", 10) || 1
  const itemsPerPage = 20

  const actor = await fetchActor(actorId)

  if (!actor) {
    notFound()
  }

  const { movies, total, totalPages } = await fetchMoviesByActor(actorId, itemsPerPage, currentPage)
  const basePath = `/actor/${id}`

  // Separate movies and series for display counts
  const actorMovies = movies.filter((m) => m.type === "movie")
  const actorSeries = movies.filter((m) => m.type === "series")

  // Get total counts for movies and series (we need to fetch all to get accurate counts)
  // For now, we'll use the filtered results for counts, but ideally we'd have separate queries
  // For pagination purposes, we'll show all movies together with pagination

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container px-4 py-8">
          {/* Actor Header */}
          <div className="flex flex-col md:flex-row gap-8 mb-12">
            <div className="flex-shrink-0">
              <div className="relative w-[200px] md:w-[250px] aspect-[2/3] rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={
                    (actor.photo_url?.startsWith("/uploads/") ? actor.photo_url.replace("/uploads/", "/api/images/") : actor.photo_url) ||
                    `/placeholder.svg?height=450&width=300&query=${encodeURIComponent(actor.name) || "/placeholder.svg"}`
                  }
                  alt={actor.name}
                  fill
                  className="object-cover"
                  priority
                  unoptimized={true}
                />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4">{actor.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">{total}</span> Total Appearances
                </div>
                {actorMovies.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">{actorMovies.length}</span> Movies (this page)
                  </div>
                )}
                {actorSeries.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">{actorSeries.length}</span> TV Shows (this page)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content with Pagination */}
          {movies.length > 0 ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">All Content ({total})</h2>
              </div>

              <ArchiveClient
                movies={movies}
                total={total}
                totalPages={totalPages}
                currentPage={currentPage}
                basePath={basePath}
              />
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No movies or shows found for this actor.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
