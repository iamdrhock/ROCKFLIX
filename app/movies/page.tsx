import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MoviesClient } from "./movies-client"
import { createClient } from "@supabase/supabase-js"
import {
  fetchMoviesFromContabo,
  fetchGenresFromContabo,
  fetchCountriesFromContabo,
  fetchYearsFromContabo,
} from "@/lib/database/movies-contabo"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

interface MoviesPageProps {
  searchParams: Promise<{ page?: string; genre?: string; country?: string; year?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const { data: settings } = await supabase
      .from("site_settings")
      .select("site_title, meta_movies_list_title")
      .single()

    if (settings) {
      // Replace {site_name} placeholder with actual site name
      const title =
        settings.meta_movies_list_title?.replace(/{site_name}/g, settings.site_title) ||
        `Movies - Watch/Download Full Movies HD Free | ${settings.site_title}`

      return {
        title,
        description: `Browse and watch thousands of movies in HD quality for free on ${settings.site_title}`,
      }
    }
  } catch (error) {
    console.error("Error fetching settings for metadata:", error)
  }

  return {
    title: "Movies - Watch/Download Full Movies HD Free",
    description: "Browse and watch thousands of movies in HD quality for free",
  }
}

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
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

  const [moviesData, genresList, countriesList, yearsList] = await Promise.all([
    fetchMoviesFromContabo("movie", itemsPerPage, currentPage, filters),
    fetchGenresFromContabo(),
    fetchCountriesFromContabo("movie"),
    fetchYearsFromContabo("movie"),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Movies</h1>
          <p className="text-muted-foreground">
            Browse all available movies ({moviesData.total} {moviesData.total === 1 ? "movie" : "movies"} found)
          </p>
        </div>

        <MoviesClient
          initialMovies={moviesData.movies}
          total={moviesData.total}
          totalPages={moviesData.totalPages}
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
