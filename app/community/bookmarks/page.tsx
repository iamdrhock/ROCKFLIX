import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { BookmarkedPosts } from "@/components/community/bookmarked-posts"

export default function BookmarksPage() {
  return (
    <div className="min-h-screen bg-black">
      <TalkFlixHeader />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Bookmarks</h1>
          <p className="text-gray-400 mt-1">Posts you've saved for later</p>
        </div>
        <BookmarkedPosts />
      </main>
    </div>
  )
}
