import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SeriesClient } from "./series-client"
import { fetchMovies, fetchGenres, fetchCountries, fetchYears } from "@/lib/api"
import { createClient } from "@supabase/supabase-js"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

interface SeriesPageProps {
  searchParams: Promise<{ page?: string; genre?: string; country?: string; year?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const { data: settings } = await supabase
      .from("site_settings")
      .select("site_title, meta_series_list_title")
      .single()

    if (settings) {
      // Replace {site_name} placeholder with actual site name
      const title =
        settings.meta_series_list_title?.replace(/{site_name}/g, settings.site_title) ||
        `TV Shows - Watch/Download Full Seasons HD Free | ${settings.site_title}`

      return {
        title,
        description: `Browse and watch thousands of TV shows and series in HD quality for free on ${settings.site_title}`,
      }
    }
  } catch (error) {
    console.error("Error fetching settings for metadata:", error)
  }

  return {
    title: "TV Shows - Watch/Download Full Seasons HD Free",
    description: "Browse and watch thousands of TV shows and series in HD quality for free",
  }
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const params = await searchParams
  const { page, genre, country, year } = params
  const currentPage = Number.parseInt(page || "1", 10) || 1
  const itemsPerPage = 20

  // Parse filters from URL
  const filters = {
    genre: genre || null,
    country: country || null,
    year: year ? Number.parseInt(year, 10) : null,
  }

  const [seriesData, genresList, countriesList, yearsList] = await Promise.all([
    fetchMovies("series", itemsPerPage, currentPage, filters),
    fetchGenres(),
    fetchCountries("series"),
    fetchYears("series"),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">TV Shows</h1>
          <p className="text-muted-foreground">
            Browse all available TV shows ({seriesData.total} {seriesData.total === 1 ? "show" : "shows"} found)
          </p>
        </div>

        <SeriesClient
          initialSeries={seriesData.movies}
          total={seriesData.total}
          totalPages={seriesData.totalPages}
          currentPage={currentPage}
          genres={genresList}
          countries={countriesList}
          years={yearsList}
        />
      </main>

      <Footer />
    </div>
  )
}
