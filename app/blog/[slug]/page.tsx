import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getImageUrl } from "@/lib/image-url"

export const dynamicParams = true

export async function generateStaticParams() {
  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      const result = await queryContabo<{ slug: string }>('SELECT slug FROM blog_posts WHERE published = true')
      
      return (result.rows || []).map((post) => ({
        slug: post.slug,
      }))
    } catch (error) {
      console.error("[BlogPostPage] Error fetching slugs from Contabo:", error)
      return []
    }
  }

  // Fallback to Supabase
  const supabase = createServiceRoleClient()
  const { data: posts } = await supabase.from("blog_posts").select("slug").eq("published", true)

  return (
    posts?.map((post) => ({
      slug: post.slug,
    })) || []
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params
    let post: { title: string } | null = null
    let siteName = "M4UHDTV"

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
        
        // Fetch post and settings in parallel
        const [postResult, settings] = await Promise.all([
          queryContabo<{ title: string }>('SELECT title FROM blog_posts WHERE slug = $1 AND published = true LIMIT 1', [slug]),
          fetchSiteSettingsFromContabo()
        ])
        
        post = postResult.rows[0] || null
        siteName = settings.site_title || "M4UHDTV"
      } catch (error) {
        console.error("[BlogPostPage] Error fetching metadata from Contabo:", error)
      }
    }

    // Fallback to Supabase if Contabo failed or not enabled
    if (!post) {
      const supabase = createServiceRoleClient()
      const { data: postData } = await supabase
        .from("blog_posts")
        .select("title")
        .eq("slug", slug)
        .eq("published", true)
        .single()
      
      const { data: settings } = await supabase.from("site_settings").select("site_title, meta_blog_post_title").single()
      post = postData || null
      siteName = settings?.site_title || "M4UHDTV"
    }

    if (!post) {
      return {
        title: `Post Not Found - ${siteName}`,
      }
    }

    // Get settings for meta pattern if not already fetched
    let metaBlogPostTitle = null
    if (process.env.USE_CONTABO_DB !== 'true') {
      const supabase = createServiceRoleClient()
      const { data: settings } = await supabase.from("site_settings").select("meta_blog_post_title").single()
      metaBlogPostTitle = settings?.meta_blog_post_title
    } else {
      const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
      const settings = await fetchSiteSettingsFromContabo()
      metaBlogPostTitle = settings.meta_blog_post_title
    }

    // Replace placeholders in the pattern with fallback
    const title =
      metaBlogPostTitle?.replace(/{title}/g, post.title).replace(/{site_name}/g, siteName) ||
      `${post.title} - ${siteName}`

    return {
      title,
    }
  } catch (error) {
    console.error("[v0] Error generating blog post metadata:", error)
    // Fallback metadata if everything fails
    return {
      title: "Blog Post",
      description: "Read our latest blog post",
    }
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let post: any = null

  // Use Contabo if enabled
  if (process.env.USE_CONTABO_DB === 'true') {
    try {
      const { fetchBlogPostFromContabo } = await import('@/lib/database/contabo-queries')
      post = await fetchBlogPostFromContabo(slug)
      console.log("[BlogPostPage] Fetched post from Contabo:", {
        slug,
        found: !!post,
        title: post?.title,
        published: post?.published
      })
      
      // If not found with published=true, try without published filter (for debugging)
      if (!post) {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        const result = await queryContabo<any>('SELECT * FROM blog_posts WHERE slug = $1 LIMIT 1', [slug])
        if (result.rows.length > 0) {
          console.log("[BlogPostPage] Found post but not published:", {
            slug,
            published: result.rows[0].published,
            title: result.rows[0].title
          })
        } else {
          console.log("[BlogPostPage] Post not found at all for slug:", slug)
        }
      }
    } catch (error) {
      console.error("[BlogPostPage] Error fetching post from Contabo:", error)
      // Fall back to Supabase if Contabo fails
    }
  }

  // Fallback to Supabase if Contabo failed or not enabled
  if (!post) {
    const supabase = await createClient()
    const { data: postData } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("published", true).single()
    post = postData
  }

  if (!post) {
    console.error("[BlogPostPage] Post not found for slug:", slug)
    notFound()
  }

  // Ensure featured_image_url is properly formatted for Next.js Image
  if (post.featured_image_url && post.featured_image_url.startsWith('/uploads/')) {
    post.featured_image_url = post.featured_image_url.replace('/uploads/', '/api/images/')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/blog">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Link>
          </Button>

          {post.featured_image_url && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-8">
              <Image
                src={getImageUrl(post.featured_image_url) || "/placeholder.svg"}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
                unoptimized={post.featured_image_url?.startsWith('/uploads/') || post.featured_image_url?.startsWith('/api/images/')}
              />
            </div>
          )}

          <article className="prose prose-lg dark:prose-invert max-w-none">
            <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
            <p className="text-muted-foreground mb-8">
              {new Date(post.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <div
              className="[&>iframe]:w-full [&>iframe]:aspect-video [&>iframe]:rounded-lg"
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
          </article>
        </div>
      </main>

      <Footer />
    </div>
  )
}
