import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { QuoteDetailView } from "@/components/community/quote-detail-view"

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TalkFlixHeader />
      <QuoteDetailView repostId={id} />
    </div>
  )
}
