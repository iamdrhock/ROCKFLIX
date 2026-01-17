import Link from "next/link"
import Image from "next/image"
import type { Movie } from "@/lib/api"
import { getImageUrl } from "@/lib/image-url"

interface MovieCardProps {
  movie: Movie
}

export function MovieCard({ movie }: MovieCardProps) {
  const href = movie.type === "series" ? `/series/${movie.id}` : `/movie/${movie.id}`

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        <Image
          src={getImageUrl(movie.poster_url) || `/placeholder.svg?height=450&width=300&query=${encodeURIComponent(movie.title)}`}
          alt={movie.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          loading="lazy"
          unoptimized={true}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        />
        {movie.rating && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">
            IMDB {movie.rating}
          </div>
        )}
        {movie.quality && (
          <div className="absolute top-2 right-2 bg-background/80 text-foreground px-2 py-1 rounded text-xs font-semibold">
            {movie.quality}
          </div>
        )}
      </div>
      <h3 className="mt-2 text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
        {movie.title}
      </h3>
      <p className="text-xs text-muted-foreground">
        {movie.release_date ? new Date(movie.release_date).getFullYear() : "N/A"}
      </p>
    </Link>
  )
}
