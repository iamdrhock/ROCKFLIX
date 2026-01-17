"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Film, Tv, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import Image from "next/image"
import { trackSearch } from "@/lib/analytics"

interface SearchResult {
  id: number
  title: string
  type: string
  poster_url: string | null
  release_date: string
  rating: number
}

export function SearchBox() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)

  // Debounce search
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`, {
          headers: {
            'Accept': 'application/json',
          }
        })
        
        if (!response.ok) {
          console.error(`[Search] HTTP error: ${response.status} ${response.statusText}`)
          setResults([])
          setShowDropdown(false)
          setIsLoading(false)
          return
        }
        
        const text = await response.text()
        if (!text) {
          setResults([])
          setShowDropdown(false)
          setIsLoading(false)
          return
        }
        
        let data
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          console.error("[Search] JSON parse error:", parseError, "Response:", text.substring(0, 100))
          setResults([])
          setShowDropdown(false)
          setIsLoading(false)
          return
        }
        
        if (data && Array.isArray(data.results)) {
          // Validate and sanitize results
          const validResults = data.results.filter((r: any) => r && r.id && r.title)
          setResults(validResults)
          setShowDropdown(validResults.length > 0)
        } else {
          setResults([])
          setShowDropdown(false)
        }
        setIsLoading(false)
      } catch (error: any) {
        console.error("[Search] Error:", error?.message || error)
        setResults([])
        setShowDropdown(false)
        setIsLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleResultClick = (result: SearchResult) => {
    trackSearch({
      query: query,
      resultsCount: results.length,
      clickedResultId: result.id,
    }).catch((err) => console.error("[v0] Error tracking search click:", err))

    setShowDropdown(false)
    setQuery("")
    router.push(`/${result.type}/${result.id}`)
  }

  const handleViewAllResults = () => {
    setShowDropdown(false)
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim().length > 0) {
      handleViewAllResults()
    }
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search any movie/series"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10 h-11 bg-background/50 border-border/50 focus:bg-background"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-[400px] overflow-y-auto">
          <div className="p-2">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
              >
                <div className="relative w-12 h-16 flex-shrink-0 bg-muted rounded overflow-hidden">
                  {result.poster_url ? (
                    <Image
                      src={(result.poster_url?.startsWith("/uploads/") ? result.poster_url.replace("/uploads/", "/api/images/") : result.poster_url) || "/placeholder.svg"}
                      alt={result.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                      unoptimized={result.poster_url?.startsWith("/uploads/")}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {result.type === "movie" ? (
                        <Film className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Tv className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{result.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{result.type}</span>
                    {result.release_date && <span>• {result.release_date.split("-")[0]}</span>}
                    {result.rating > 0 && <span>• ⭐ {result.rating.toFixed(1)}</span>}
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={handleViewAllResults}
              className="w-full mt-2 p-2 text-sm text-primary hover:bg-accent rounded-md transition-colors font-medium"
            >
              View all results for "{query}"
            </button>
          </div>
        </Card>
      )}

      {showDropdown && query.trim().length > 0 && results.length === 0 && !isLoading && (
        <Card className="absolute top-full mt-2 w-full z-50 p-4 text-center text-sm text-muted-foreground">
          No results found for "{query}"
        </Card>
      )}
    </div>
  )
}
