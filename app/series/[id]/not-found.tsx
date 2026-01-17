import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Film } from "lucide-react"

export default function SeriesNotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <Film className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-3xl font-bold">Series Not Found</h1>
          <p className="text-muted-foreground">The series you're looking for doesn't exist or has been removed.</p>
          <Link href="/series">
            <Button>Browse Series</Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
