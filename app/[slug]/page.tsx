import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

const RESERVED_SLUGS = [
  "movies",
  "series",
  "tv-shows",
  "genres",
  "blog",
  "admin",
  "api",
  "watch",
  "search",
  "movie",
  "favicon.ico",
  "_next",
  "public",
  "static",
]

export async function generateStaticParams() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: pages } = await supabase.from("custom_pages").select("slug").eq("published", true)
    return (pages || []).map((page) => ({ slug: page.slug }))
  } catch (error) {
    return []
  }
}

export const dynamicParams = true

async function getSettings() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data, error } = await supabase.from("site_settings").select("site_title, site_logo_url").single()
    if (error) throw error
    return data
  } catch (error) {
    return { site_title: "M4UHDTV", site_logo_url: null }
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const { data: page } = await supabase
      .from("custom_pages")
      .select("title")
      .eq("slug", slug)
      .eq("published", true)
      .single()

    const { data: settings } = await supabase.from("site_settings").select("site_title, meta_page_title").single()
    const siteName = settings?.site_title || "M4UHDTV"

    if (!page) {
      return {
        title: `Page Not Found - ${siteName}`,
      }
    }

    const title =
      settings?.meta_page_title?.replace(/{title}/g, page.title).replace(/{site_name}/g, siteName) ||
      `${page.title} - ${siteName}`

    return { title }
  } catch (error) {
    return {
      title: "Page",
      description: "View this page",
    }
  }
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  console.log("[v0] Custom page route accessed with slug:", slug)

  if (RESERVED_SLUGS.includes(slug) || slug.includes(".")) {
    console.log("[v0] Slug is reserved or contains dot, redirecting to home:", slug)
    redirect("/")
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const settings = await getSettings()

  const { data: page, error } = await supabase
    .from("custom_pages")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single()

  if (error || !page) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-primary">
            {settings.site_logo_url ? (
              <Image
                src={settings.site_logo_url || "/placeholder.svg"}
                alt={settings.site_title}
                width={200}
                height={50}
                className="h-10 w-auto"
              />
            ) : (
              settings.site_title
            )}
          </Link>
          <nav className="flex gap-6">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <Link href="/movies" className="hover:text-primary">
              Movies
            </Link>
            <Link href="/series" className="hover:text-primary">
              TV Shows
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>

          {page.featured_image_url && (
            <div className="mb-8 overflow-hidden rounded-lg">
              <Image
                src={page.featured_image_url || "/placeholder.svg"}
                alt={page.title}
                width={1200}
                height={600}
                className="h-[400px] w-full object-cover"
              />
            </div>
          )}

          <h1 className="mb-6 text-4xl font-bold">{page.title}</h1>

          <div
            className="prose prose-lg dark:prose-invert max-w-none [&>iframe]:w-full [&>iframe]:aspect-video [&>iframe]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />

          <div className="mt-12 border-t pt-6 text-sm text-muted-foreground">
            Last updated: {new Date(page.updated_at).toLocaleDateString()}
          </div>
        </div>
      </main>
    </div>
  )
}
