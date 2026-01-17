import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArchiveClient } from "@/components/archive-client"
import { fetchMoviesByYear } from "@/lib/api"
import { Calendar } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface YearPageProps {
  params: Promise<{ year: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: YearPageProps): Promise<Metadata> {
  const { year } = await params
  const yearNum = Number.parseInt(year, 10)

  // Use Contabo if enabled
  let siteName = "M4UHDTV"
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
      const settings = await fetchSiteSettingsFromContabo()
      siteName = settings?.site_title || "M4UHDTV"
    } catch (error) {
      console.error("[YearPage] Error fetching site settings from Contabo:", error)
    }
  } else {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: settings } = await supabase.from("site_settings").select("site_title").single()
    siteName = settings?.site_title || "M4UHDTV"
  }

  return {
    title: `${yearNum} Movies & TV Shows - ${siteName}`,
    description: `Browse all movies and TV shows released in ${yearNum}. Watch and download ${yearNum} content in HD quality for free.`,
  }
}

export default async function YearPage({ params, searchParams }: YearPageProps) {
  const { year } = await params
  const params_obj = await searchParams
  const yearNum = Number.parseInt(year, 10)
  const currentPage = Number.parseInt(params_obj.page || "1", 10) || 1
  const itemsPerPage = 20

  const { movies, total, totalPages } = await fetchMoviesByYear(yearNum, itemsPerPage, currentPage)
  const basePath = `/year/${year}`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Calendar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{yearNum}</h1>
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
