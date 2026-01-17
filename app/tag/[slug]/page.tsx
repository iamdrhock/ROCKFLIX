import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArchiveClient } from "@/components/archive-client"
import { fetchMoviesByTag } from "@/lib/api"
import { Tag } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { fetchSiteSettingsFromContabo, fetchTagFromContabo } from "@/lib/database/contabo-queries"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface TagPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params
  const tagName = decodeURIComponent(slug).replace(/-/g, " ")

  // Use Contabo if enabled
  let siteName = "ROCKFLIX"
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const settings = await fetchSiteSettingsFromContabo()
      siteName = settings?.site_title || "ROCKFLIX"
    } catch (error) {
      console.error("[TagPage] Error fetching site settings from Contabo:", error)
    }
  } else {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: settings } = await supabase.from("site_settings").select("site_title").single()
    siteName = settings?.site_title || "ROCKFLIX"
  }

  return {
    title: `${tagName.charAt(0).toUpperCase() + tagName.slice(1)} - Movies & TV Shows Tagged - ${siteName}`,
    description: `Browse all movies and TV shows tagged with ${tagName}. Watch and download content related to ${tagName} in HD quality for free.`,
    keywords: `${tagName}, movies, tv shows, watch ${tagName}, ${tagName} movies, ${tagName} series`,
    openGraph: {
      title: `${tagName.charAt(0).toUpperCase() + tagName.slice(1)} - ${siteName}`,
      description: `Browse all movies and TV shows tagged with ${tagName}`,
      type: "website",
    },
  }
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { slug } = await params
  const params_obj = await searchParams
  const currentPage = Number.parseInt(params_obj.page || "1", 10) || 1
  const itemsPerPage = 20

  // Fetch tag details - use Contabo if enabled
  let tag: { id: number; name: string } | null = null
  const useContabo = process.env.USE_CONTABO_DB === 'true'
  
  if (useContabo) {
    try {
      const tagData = await fetchTagFromContabo(slug)
      if (tagData) {
        tag = { id: tagData.id, name: tagData.name }
      }
    } catch (error) {
      console.error("[TagPage] Error fetching tag from Contabo:", error)
    }
  } else {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await supabase.from("tags").select("id, name").eq("slug", slug).single()
    tag = data
  }

  if (!tag) {
    notFound()
  }

  // Fetch movies with pagination (fetchMoviesByTag already uses Contabo when enabled)
  const { movies, total, totalPages } = await fetchMoviesByTag(slug, itemsPerPage, currentPage)
  const basePath = `/tag/${slug}`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Tag className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold capitalize">{tag.name}</h1>
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
