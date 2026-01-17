import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"
  
  return {
    name: 'ROCKFLIX - Movies & TV Shows',
    short_name: 'ROCKFLIX',
    description: 'Stream the latest movies and TV shows in HD quality',
    start_url: '/',
    display: 'standalone',
    background_color: '#060606',
    theme_color: '#c4fa6b',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any',
      },
    ],
    categories: ['entertainment', 'video', 'movies', 'tv'],
    shortcuts: [
      {
        name: 'Movies',
        short_name: 'Movies',
        description: 'Browse all movies',
        url: '/movies',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'TV Series',
        short_name: 'Series',
        description: 'Browse TV series',
        url: '/series',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}

