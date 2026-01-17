"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchBox } from "@/components/search-box"

interface Settings {
  site_title: string
  site_logo_url: string | null
  header_menu: Array<{ label: string; url: string }>
}

export function ClientHeader() {
  const [settings, setSettings] = useState<Settings>({
    site_title: "M4UHDTV",
    site_logo_url: null,
    header_menu: [
      { label: "Home", url: "/" },
      { label: "Movies", url: "/movies" },
      { label: "TV Shows", url: "/series" },
      { label: "Genres", url: "/genres" },
    ],
  })

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings")
        if (response.ok) {
          const data = await response.json()
          setSettings({
            site_title: data.site_title || "M4UHDTV",
            site_logo_url: data.site_logo_url,
            header_menu: data.header_menu || [
              { label: "Home", url: "/" },
              { label: "Movies", url: "/movies" },
              { label: "TV Shows", url: "/series" },
              { label: "Genres", url: "/genres" },
            ],
          })
        }
      } catch (error) {
        console.error("[v0] Error fetching settings:", error)
      }
    }

    fetchSettings()
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          {settings.site_logo_url ? (
            <Image
              src={settings.site_logo_url || "/placeholder.svg"}
              alt={settings.site_title}
              width={300}
              height={112}
              className="h-16 w-auto max-w-full object-contain"
              priority
            />
          ) : (
            <div className="text-2xl font-bold">
              <span className="text-primary">
                {settings.site_title.slice(0, Math.ceil(settings.site_title.length / 2))}
              </span>
              <span className="text-foreground">
                {settings.site_title.slice(Math.ceil(settings.site_title.length / 2))}
              </span>
            </div>
          )}
        </Link>

        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          {settings.header_menu.map((item, index) => (
            <Link key={index} href={item.url} className="transition-colors hover:text-primary text-foreground/80">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/movies">
              <Film className="h-5 w-5" />
              <span className="sr-only">Browse Movies</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="container px-4 pb-4">
        <SearchBox />
      </div>

    </header>
  )
}
