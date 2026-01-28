
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getWatchlistFromContabo } from "@/lib/database/contabo-writes"
import { MovieCard } from "@/components/movie-card"
import { Bookmark, Film } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function WatchlistPage() {
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
        redirect("/auth/login")
    }

    const watchlist = await getWatchlistFromContabo(userId)

    return (
        <div className="container py-8">
            <div className="flex items-center gap-3 mb-6">
                <Bookmark className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">My Watchlist</h1>
            </div>

            {watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/20">
                    <Film className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Your watchlist is empty</h2>
                    <p className="text-muted-foreground max-w-sm mb-6">
                        Save movies and TV shows to your watchlist to keep track of what you want to watch next.
                    </p>
                    <a href="/movies" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                        Browse Movies
                    </a>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {watchlist.map((item: any) => (
                        <MovieCard key={item.id} movie={item.movies} />
                    ))}
                </div>
            )}
        </div>
    )
}
