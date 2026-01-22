
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getFavoritesFromContabo } from "@/lib/database/contabo-writes"
import { MovieCard } from "@/components/movie-card"
import { Heart, Film } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function FavoritesPage() {
    const session = await getAuthSession()

    if (!session?.user?.id) {
        redirect("/auth/login")
    }

    const favorites = await getFavoritesFromContabo(session.user.id)

    return (
        <div className="container py-8">
            <div className="flex items-center gap-3 mb-6">
                <Heart className="h-8 w-8 text-red-500 fill-current" />
                <h1 className="text-3xl font-bold">My Favorites</h1>
            </div>

            {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/20">
                    <Heart className="h-16 w-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No favorites yet</h2>
                    <p className="text-muted-foreground max-w-sm mb-6">
                        Mark movies and TV shows as favorites to quickly access them later.
                    </p>
                    <a href="/movies" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                        Browse Movies
                    </a>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {favorites.map((movie: any) => (
                        <MovieCard key={movie.id} movie={movie} />
                    ))}
                </div>
            )}
        </div>
    )
}
