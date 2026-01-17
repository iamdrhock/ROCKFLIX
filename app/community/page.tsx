import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { TalkFlixFooter } from "@/components/community/talkflix-footer"
import { MobileMenuBar } from "@/components/community/mobile-menu-bar"
import { CommunityFeed } from "@/components/community/community-feed"
import { CreatePostCard } from "@/components/community/create-post-card"
import { TrendingHashtags } from "@/components/community/trending-hashtags"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const communityUrl = process.env.NEXT_PUBLIC_COMMUNITY_URL || "https://talkflix.org"

  return {
    title: "TalkFlix - The Social Network for Movie Lovers",
    description:
      "Join TalkFlix, the ultimate social platform for movie and series enthusiasts. Share your thoughts, discuss latest releases, and connect with fellow cinephiles.",
    keywords: "movie community, film discussion, TV series community, movie social network, cinema fans",
    openGraph: {
      title: "TalkFlix - The Social Network for Movie Lovers",
      description:
        "Join TalkFlix, the ultimate social platform for movie and series enthusiasts. Share, discuss, and connect.",
      url: `${communityUrl}/community`,
      siteName: "TalkFlix",
      type: "website",
      images: [
        {
          url: `${communityUrl}/placeholder.svg?height=630&width=1200&query=TalkFlix+Community`,
          width: 1200,
          height: 630,
          alt: "TalkFlix Community",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "TalkFlix - The Social Network for Movie Lovers",
      description: "Join TalkFlix and connect with movie enthusiasts worldwide.",
    },
    alternates: {
      canonical: `${communityUrl}/community`,
    },
  }
}

export default async function TalkFlixPage() {
  // Double-check redirect at page level (in case middleware is bypassed)
  const headersList = await headers()
  const host = headersList.get("host") || ""
  
  if (host.includes("rockflix.tv") || host.includes("www.rockflix.tv")) {
    const communityUrl = process.env.NEXT_PUBLIC_COMMUNITY_URL || "https://talkflix.org"
    redirect(`${communityUrl}/community`)
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TalkFlixHeader />
      <MobileMenuBar />
      <main className="flex-1 bg-gradient-to-b from-black to-gray-950">
        <div className="container max-w-7xl py-8 px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {user && <CreatePostCard />}
              <CommunityFeed />
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <TrendingHashtags />
              </div>
            </div>
          </div>
        </div>
      </main>
      <TalkFlixFooter />
    </div>
  )
}
