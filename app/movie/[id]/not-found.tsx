import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <h1 className="text-4xl font-bold">Movie Not Found</h1>
          <p className="text-muted-foreground">The movie you're looking for doesn't exist or has been removed.</p>
          <Link href="/">
            <Button className="bg-primary hover:bg-primary/90">Back to Home</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
