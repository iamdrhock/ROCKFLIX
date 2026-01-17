import { Suspense } from "react"
import { Header } from "@/components/header"
import { createClient } from "@supabase/supabase-js"
import { MovieCard } from "@/components/movie-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Search, Mail } from "lucide-react"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams
  const query = params.q || ""
  const type = params.type || "all"
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: settings } = await supabase.from("site_settings").select("site_title").single()
  const siteName = settings?.site_title || "M4UHDTV"

  if (!query || query.trim().length === 0) {
    return {
      title: `Search Movies & TV Shows - ${siteName}`,
      description: `Search for your favorite movies and TV shows on ${siteName}. Find and watch thousands of titles in HD quality.`,
      robots: {
        index: true,
        follow: true,
      },
    }
  }

  const typeText = type === "movie" ? "Movies" : type === "series" ? "TV Shows" : "Content"
  const title = `Search: ${query} - ${typeText} on ${siteName}`
  const description = `Search results for "${query}". Find ${type === "all" ? "movies and TV shows" : typeText.toLowerCase()} matching your query on ${siteName}.`

  return {
    title,
    description,
    keywords: `${query}, search ${query}, watch ${query}, ${query} online, ${type}`,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/search?q=${encodeURIComponent(query)}`,
      siteName,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ""
  const type = params.type || "all"
  const page = Number.parseInt(params.page || "1")
  const perPage = 24

  if (!query || query.trim().length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Search className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Search for Movies & TV Shows</h2>
        <p className="text-muted-foreground mb-6">
          Enter a title in the search box above to find your favorite content
        </p>
      </div>
    )
  }

  // Create Supabase client
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  // Build query
  let supabaseQuery = supabase.from("movies").select("*", { count: "exact" }).ilike("title", `%${query}%`)

  // Filter by type if specified
  if (type === "movie" || type === "series") {
    supabaseQuery = supabaseQuery.eq("type", type)
  }

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data: results, error, count } = await supabaseQuery.order("views", { ascending: false }).range(from, to)

  if (error) {
    console.error("[v0] Search error:", error)
  }

  const totalPages = count ? Math.ceil(count / perPage) : 0

  return (
    <div className="space-y-6">
      {/* Search Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Search Results for "{query}"</h1>
          <p className="text-muted-foreground">
            Found {count || 0} {type === "all" ? "results" : type === "movie" ? "movies" : "TV shows"}
          </p>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2">
          <Link href={`/search?q=${encodeURIComponent(query)}&type=all`}>
            <Button variant={type === "all" ? "default" : "outline"} size="sm">
              All
            </Button>
          </Link>
          <Link href={`/search?q=${encodeURIComponent(query)}&type=movie`}>
            <Button variant={type === "movie" ? "default" : "outline"} size="sm">
              Movies
            </Button>
          </Link>
          <Link href={`/search?q=${encodeURIComponent(query)}&type=series`}>
            <Button variant={type === "series" ? "default" : "outline"} size="sm">
              TV Shows
            </Button>
          </Link>
        </div>
      </div>

      {/* Results Grid */}
      {results && results.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map((item) => (
              <MovieCard key={item.id} movie={item} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-8">
              {page > 1 && (
                <Link href={`/search?q=${encodeURIComponent(query)}&type=${type}&page=${page - 1}`}>
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
              </div>
              {page < totalPages && (
                <Link href={`/search?q=${encodeURIComponent(query)}&type=${type}&page=${page + 1}`}>
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Results Found</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't find any {type === "all" ? "content" : type === "movie" ? "movies" : "TV shows"} matching "
            {query}"
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
            <a
              href={`mailto:rockflixonline@gmail.com?subject=Movie Request: ${encodeURIComponent(query)}&body=Hi ROCKFLIX Team,%0D%0A%0D%0AI would like to request the following content:%0D%0A%0D%0ATitle: ${encodeURIComponent(query)}%0D%0AType: ${type === "movie" ? "Movie" : type === "series" ? "TV Show" : "Movie or TV Show"}%0D%0A%0D%0AThank you!`}
            >
              <Button className="gap-2">
                <Mail className="h-4 w-4" />
                Request This Movie
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Can't find what you're looking for? Send us a request and we'll try to add it!
          </p>
        </div>
      )}
    </div>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <>
      <Header />
      <main className="container px-4 py-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          }
        >
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  )
}
