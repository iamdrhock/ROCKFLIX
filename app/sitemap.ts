import type { MetadataRoute } from "next"
import { fetchAllMoviesForSitemap, fetchAllActorsForSitemap, fetchGenres, fetchYears } from "@/lib/api"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/series`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ]

  // Movie and series pages
  const movies = await fetchAllMoviesForSitemap()
  const moviePages: MetadataRoute.Sitemap = movies.map((movie) => ({
    url: `${baseUrl}/${movie.type}/${movie.id}`,
    lastModified: movie.updated_at ? new Date(movie.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  // Actor pages
  const actors = await fetchAllActorsForSitemap()
  const actorPages: MetadataRoute.Sitemap = actors.map((actor) => ({
    url: `${baseUrl}/actor/${actor.id}`,
    lastModified: actor.updated_at ? new Date(actor.updated_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  // Genre pages
  const genres = await fetchGenres()
  const genrePages: MetadataRoute.Sitemap = genres.map((genre) => ({
    url: `${baseUrl}/genre/${genre.toLowerCase().replace(/\s+/g, "-")}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  // Year pages
  const years = await fetchYears()
  const yearPages: MetadataRoute.Sitemap = years.slice(0, 20).map((year) => ({
    url: `${baseUrl}/year/${year}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticPages, ...moviePages, ...actorPages, ...genrePages, ...yearPages]
}
