import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { SearchResults } from "@/components/community/search-results"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

  return {
    title: "Search TalkFlix - Find Posts, Users & Discussions",
    description:
      "Search for posts, users, and movie discussions on TalkFlix. Discover trending topics and connect with fellow movie enthusiasts.",
    keywords: "search TalkFlix, find posts, movie discussions, user search, community search",
    openGraph: {
      title: "Search TalkFlix",
      description: "Find posts, users, and movie discussions on TalkFlix community.",
      url: `${siteUrl}/community/search`,
      siteName: "TalkFlix",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Search TalkFlix",
      description: "Find posts, users, and movie discussions.",
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TalkFlixHeader />
      <main className="flex-1 bg-gradient-to-b from-black to-gray-950">
        <div className="container max-w-4xl py-8 px-4">
          <Suspense
            fallback={
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
              </div>
            }
          >
            <SearchResults />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
