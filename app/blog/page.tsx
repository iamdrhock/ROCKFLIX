import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createClient as createPublicClient } from "@supabase/supabase-js"
import type { Metadata } from "next"
import { getImageUrl } from "@/lib/image-url"

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = createPublicClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data: settings } = await supabase.from("site_settings").select("site_title, meta_blog_list_title").single()

    if (settings) {
      // Replace {site_name} placeholder with actual site name
      const title =
        settings.meta_blog_list_title?.replace(/{site_name}/g, settings.site_title) ||
        `Blog - Latest News & Updates | ${settings.site_title}`

      return {
        title,
        description: `Read the latest news, updates, and articles from ${settings.site_title}`,
      }
    }
  } catch (error) {
    console.error("Error fetching settings for metadata:", error)
  }

  return {
    title: "Blog - Latest News & Updates",
    description: "Read the latest news, updates, and articles",
  }
}

async function getSettings() {
  try {
    const supabase = createPublicClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data, error } = await supabase.from("site_settings").select("site_title").single()

    if (error) throw error
    return data
  } catch (error) {
    return { site_title: "M4UHDTV" }
  }
}

export default async function BlogPage() {
  const supabase = await createClient()
  const settings = await getSettings()

  // Fetch blog posts - use Contabo if enabled
  let posts: any[] = []
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchBlogPostsFromContabo } = await import('@/lib/database/contabo-queries')
      const result = await fetchBlogPostsFromContabo(1, 20)
      posts = result.posts || []
      console.log("[BlogPage] Fetched", posts.length, "posts from Contabo")
    } catch (error) {
      console.error("[BlogPage] Error fetching blog posts from Contabo:", error)
      // Fall back to Supabase if Contabo fails
      const result = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(20)
      posts = result.data || []
    }
  } else {
    const result = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(20)
    posts = result.data || []
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Blog</h1>
          <p className="text-muted-foreground">Latest news and updates from {settings.site_title}</p>
        </div>

        {!posts || posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No blog posts available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  {post.featured_image_url && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
                      <Image
                        src={getImageUrl(post.featured_image_url) || "/placeholder.svg"}
                        alt={post.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        unoptimized={post.featured_image_url?.startsWith('/uploads/') || post.featured_image_url?.startsWith('/api/images/')}
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                    <CardDescription>
                      {new Date(post.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">{post.body}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
