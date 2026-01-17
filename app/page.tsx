import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MovieCard } from "@/components/movie-card"
import { fetchTrendingMovies, fetchLatestMovies, fetchTrendingActors } from "@/lib/api"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createClient as createPublicClient } from "@supabase/supabase-js"
import type { Metadata } from "next"
import { CommunityPreview } from "@/components/community/community-preview"

// Changed to dynamic to show user session correctly
// The Header component needs to check session on each request
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.tv"
    let settings: any = null

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
      settings = await fetchSiteSettingsFromContabo()
    } else {
      // Fallback to Supabase
      const supabase = createPublicClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const { data } = await supabase
        .from("site_settings")
        .select("site_title, site_description, meta_home_title, site_logo_url, site_favicon_url")
        .single()
      
      settings = data
    }

    if (settings) {
      // Replace {site_name} placeholder with actual site name
      const title =
        settings.meta_home_title?.replace(/{site_name}/g, settings.site_title) ||
        `${settings.site_title} - Watch/Download Movies & TV Shows HD Free`

      const description =
        settings.site_description ||
        `Watch and download the latest movies and TV shows in HD quality for free on ${settings.site_title}`

      // Ensure logo/favicon URL is absolute and accessible
      let ogImage = null
      
      // Try logo first, then favicon, then placeholder
      if (settings.site_logo_url) {
        // If logo is relative, make it absolute
        ogImage = settings.site_logo_url.startsWith('http') 
          ? settings.site_logo_url 
          : `${siteUrl}${settings.site_logo_url.startsWith('/') ? '' : '/'}${settings.site_logo_url}`
      } else if (settings.site_favicon_url) {
        // Use favicon as fallback
        ogImage = settings.site_favicon_url.startsWith('http')
          ? settings.site_favicon_url
          : `${siteUrl}${settings.site_favicon_url.startsWith('/') ? '' : '/'}${settings.site_favicon_url}`
      } else {
        // Use placeholder as last resort
        ogImage = `${siteUrl}/placeholder.svg?height=630&width=1200&query=movies`
      }

      return {
        title,
        description,
        keywords: ["movies", "tv shows", "streaming", "watch movies", "free movies", "HD movies", "entertainment"],
        authors: [{ name: settings.site_title }],
        openGraph: {
          type: "website",
          locale: "en_US",
          url: siteUrl,
          siteName: settings.site_title,
          title,
          description,
          images: [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: settings.site_title,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [ogImage],
        },
        alternates: {
          canonical: siteUrl,
        },
      }
    }
  } catch (error) {
    console.error("Error fetching settings for metadata:", error)
  }

  // Fallback metadata
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.tv"
  const fallbackImage = `${siteUrl}/placeholder.svg?height=630&width=1200&query=movies`
  
  return {
    title: "Watch/Download Movies & TV Shows HD Free",
    description: "Watch and download the latest movies and TV shows in HD quality for free",
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName: "ROCKFLIX",
      title: "ROCKFLIX - Watch/Download Movies & TV Shows HD Free",
      description: "Watch and download the latest movies and TV shows in HD quality for free",
      images: [
        {
          url: fallbackImage,
          width: 1200,
          height: 630,
          alt: "ROCKFLIX",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "ROCKFLIX - Watch/Download Movies & TV Shows HD Free",
      description: "Watch and download the latest movies and TV shows in HD quality for free",
      images: [fallbackImage],
    },
  }
}

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch latest blog post - use Contabo if enabled
  let latestBlogPost: any = null
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchBlogPostsFromContabo } = await import('@/lib/database/contabo-queries')
      const result = await fetchBlogPostsFromContabo(1, 1)
      latestBlogPost = result.posts?.[0] || null
    } catch (error) {
      console.error("[HomePage] Error fetching blog post from Contabo:", error)
      // Fall back to Supabase if Contabo fails
      const result = await supabase.from("blog_posts").select("*").eq("published", true).order("created_at", { ascending: false }).limit(1)
      latestBlogPost = result.data?.[0] || null
    }
  } else {
    const result = await supabase.from("blog_posts").select("*").eq("published", true).order("created_at", { ascending: false }).limit(1)
    latestBlogPost = result.data?.[0] || null
  }

  const [trendingMovies, trendingShows, latestMovies, latestShows, trendingActors] = await Promise.all([
    fetchTrendingMovies("movie", 10),
    fetchTrendingMovies("series", 10),
    fetchLatestMovies("movie", 10),
    fetchLatestMovies("series", 10),
    fetchTrendingActors(6),
  ])

  const blogPost = latestBlogPost

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Trending Movies Section */}
        <section className="container px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Trending Movies</h2>
            <Link href="/movies" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>

          {trendingMovies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {trendingMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No movies available yet. Add some movies from the{" "}
              <Link href="/arike" className="text-primary hover:underline">
                admin panel
              </Link>
              !
            </p>
          )}
        </section>

        {/* Trending Shows Section */}
        <section className="container px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Trending Shows</h2>
            <Link href="/series" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>

          {trendingShows.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {trendingShows.map((show) => (
                <MovieCard key={show.id} movie={show} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No TV shows available yet. Add some shows from the{" "}
              <Link href="/arike" className="text-primary hover:underline">
                admin panel
              </Link>
              !
            </p>
          )}
        </section>

        <section className="container px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Latest Movies</h2>
            <Link href="/movies" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>

          {latestMovies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {latestMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No recent movies available yet.</p>
          )}
        </section>

        <section className="container px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Latest Shows</h2>
            <Link href="/series" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>

          {latestShows.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {latestShows.map((show) => (
                <MovieCard key={show.id} movie={show} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No recent TV shows available yet.</p>
          )}
        </section>

        {/* Featured Actors Section */}
        <section className="container px-4 py-8">
          <h2 className="text-2xl font-bold mb-6">Featured Actors</h2>

          {trendingActors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {trendingActors.map((actor) => (
                <Link key={actor.id} href={`/actor/${actor.id}`}>
                  <div className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-muted hover:opacity-90 transition-opacity">
                    <Image
                      src={
                        actor.photo_url && actor.photo_url.startsWith('/uploads/')
                          ? actor.photo_url.replace('/uploads/', '/api/images/')
                          : actor.photo_url || `/placeholder.svg?height=450&width=300&query=${encodeURIComponent(actor.name + " actor")}`
                      }
                      alt={actor.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 20vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-bold text-white">{actor.name}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No actors available yet.</p>
          )}
        </section>

        {/* Community Preview Section */}
        <section className="container px-4 py-8">
          <CommunityPreview />
        </section>

        {/* Latest News Section */}
        <section className="container px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Latest News</h2>
            <Link href="/blog" className="text-sm text-primary hover:underline">
              View All Posts
            </Link>
          </div>
          {blogPost ? (
            <Link href={`/blog/${blogPost.slug}`}>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity">
                <Image
                  src={blogPost.featured_image_url ? (blogPost.featured_image_url.startsWith('/uploads/') 
                    ? blogPost.featured_image_url.replace('/uploads/', '/api/images/')
                    : blogPost.featured_image_url) : "/placeholder.svg"}
                  alt={blogPost.title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-2xl font-bold mb-2">{blogPost.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{blogPost.body}</p>
                </div>
              </div>
            </Link>
          ) : (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <Image src="/news-collage.png" alt="Latest News" fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-2xl font-bold mb-2">Stay Tuned for Updates</h3>
                <p className="text-sm text-white/80">Check back soon for the latest news and announcements</p>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
