import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { HashtagFeed } from "@/components/community/hashtag-feed"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TalkFlixHeader />
      <main className="flex-1 bg-gradient-to-b from-black to-gray-950">
        <div className="container max-w-3xl py-8 px-4">
          <div className="mb-6">
            <Link
              href="/community"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to TalkFlix
            </Link>
            <h1 className="text-3xl font-bold text-white">
              <span className="text-red-500">#</span>
              {decodedTag}
            </h1>
          </div>
          <HashtagFeed hashtag={decodedTag} />
        </div>
      </main>
    </div>
  )
}
