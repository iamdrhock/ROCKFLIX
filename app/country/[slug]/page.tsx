import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArchiveClient } from "@/components/archive-client"
import { fetchMoviesByCountry } from "@/lib/api"
import { Globe } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface CountryPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  const { slug } = await params
  const country = decodeURIComponent(slug).replace(/-/g, " ")

  // Use Contabo if enabled
  let siteName = "M4UHDTV"
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
      const settings = await fetchSiteSettingsFromContabo()
      siteName = settings?.site_title || "M4UHDTV"
    } catch (error) {
      console.error("[CountryPage] Error fetching site settings from Contabo:", error)
    }
  } else {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: settings } = await supabase.from("site_settings").select("site_title").single()
    siteName = settings?.site_title || "M4UHDTV"
  }

  return {
    title: `${country.charAt(0).toUpperCase() + country.slice(1)} Movies & TV Shows - ${siteName}`,
    description: `Browse all movies and TV shows from ${country}. Watch and download ${country} content in HD quality for free.`,
  }
}

export default async function CountryPage({ params, searchParams }: CountryPageProps) {
  const { slug } = await params
  const params_obj = await searchParams
  const country = decodeURIComponent(slug).replace(/-/g, " ")
  const currentPage = Number.parseInt(params_obj.page || "1", 10) || 1
  const itemsPerPage = 20

  const { movies, total, totalPages } = await fetchMoviesByCountry(country, itemsPerPage, currentPage)
  const basePath = `/country/${slug}`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Globe className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold capitalize">{country}</h1>
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
