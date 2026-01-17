import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold text-red-500">Post Not Found</h2>
        <p className="mb-6 text-zinc-400">This post may have been deleted or doesn't exist.</p>
        <Link href="/community">
          <Button className="bg-red-600 hover:bg-red-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to TalkFlix
          </Button>
        </Link>
      </div>
    </div>
  )
}
