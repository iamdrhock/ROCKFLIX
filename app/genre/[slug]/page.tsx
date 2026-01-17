import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArchiveClient } from "@/components/archive-client"
import { fetchMoviesByGenre } from "@/lib/api"
import { Film } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface GenrePageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: GenrePageProps): Promise<Metadata> {
  const { slug } = await params
  const genre = decodeURIComponent(slug).replace(/-/g, " ")

  // Use Contabo if enabled
  let siteName = "M4UHDTV"
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
      const settings = await fetchSiteSettingsFromContabo()
      siteName = settings?.site_title || "M4UHDTV"
    } catch (error) {
      console.error("[GenrePage] Error fetching site settings from Contabo:", error)
    }
  } else {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: settings } = await supabase.from("site_settings").select("site_title").single()
    siteName = settings?.site_title || "M4UHDTV"
  }

  return {
    title: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Movies & TV Shows - ${siteName}`,
    description: `Browse all ${genre} movies and TV shows in HD quality. Watch and download ${genre} content for free.`,
  }
}

export default async function GenrePage({ params, searchParams }: GenrePageProps) {
  const { slug } = await params
  const params_obj = await searchParams
  const genre = decodeURIComponent(slug).replace(/-/g, " ")
  const currentPage = Number.parseInt(params_obj.page || "1", 10) || 1
  const itemsPerPage = 20

  const { movies, total, totalPages } = await fetchMoviesByGenre(genre, itemsPerPage, currentPage)
  const basePath = `/genre/${slug}`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Film className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold capitalize">{genre}</h1>
            <p className="text-muted-foreground">
              {total} {total === 1 ? "title" : "titles"} found
            </p>
          </div>
        </div>

        <ArchiveClient
          movies={movies}
          total={total}
          totalPages={totalPages}
          currentPage={currentPage}
          basePath={basePath}
        />
      </main>

      <Footer />
    </div>
  )
}
