"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Download, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useAdminSession } from "@/hooks/use-admin-session"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

interface Movie {
  id: number
  title: string
  poster_path: string | null
  release_date: string
  vote_average: number
  overview: string
}

interface Genre {
  id: number
  name: string
}

export default function ImportMoviesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("discover")
  const [movies, setMovies] = useState<Movie[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "checking">("checking")

  // Filters
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [sortBy, setSortBy] = useState("popularity.desc")
  const [searchQuery, setSearchQuery] = useState("")
  const [quality, setQuality] = useState("HD")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  // Selection
  const [selectedMovies, setSelectedMovies] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)

  const [importingMovieId, setImportingMovieId] = useState<number | null>(null)
  const [importedMovies, setImportedMovies] = useState<Set<number>>(new Set())

  const { loading: authLoading } = useAdminSession()

  useEffect(() => {
    if (authLoading) return
    // Fetch CSRF token on mount
    fetchCsrfToken().catch(console.error)
    checkApiStatus()
    loadGenres()
    loadImportedMovies()
  }, [authLoading, router])

  useEffect(() => {
    if (activeTab === "discover") {
      loadDiscoverMovies()
    }
  }, [activeTab, currentPage, year, selectedGenre, sortBy])

  useEffect(() => {
    if (movies.length > 0) {
      checkImportedMovies()
    }
  }, [movies])

  async function checkApiStatus() {
    try {
      const response = await fetch("/api/admin/tmdb/genres?type=movie", {
        credentials: "include",
        method: "GET", // Explicitly set GET method
      })
      if (response.ok) {
        const data = await response.json()
        // Check if we got valid genre data
        if (data && (data.genres || Array.isArray(data))) {
          setApiStatus("online")
        } else {
          setApiStatus("offline")
        }
      } else {
        setApiStatus("offline")
      }
    } catch (error) {
      console.error("[v0] API status check failed:", error)
      setApiStatus("offline")
    }
  }

  async function loadGenres() {
    try {
      const response = await fetch("/api/admin/tmdb/genres?type=movie", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setGenres(data.genres || [])
      }
    } catch (error) {
      console.error("Error loading genres:", error)
    }
  }

  async function loadDiscoverMovies() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        sort_by: sortBy,
      })

      if (year) params.append("year", year)
      if (selectedGenre && selectedGenre !== "all") {
        params.append("genre", selectedGenre)
      }

      const response = await fetch(`/api/admin/tmdb/discover-movies?${params}`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setMovies(data.results || [])
        setTotalPages(data.total_pages || 1)
        setTotalResults(data.total_results || 0)
      }
    } catch (error) {
      console.error("Error loading movies:", error)
      toast({
        title: "Error",
        description: "Failed to load movies from TMDB",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    setCurrentPage(1)
    try {
      const response = await fetch(`/api/admin/tmdb/search-movies?query=${encodeURIComponent(searchQuery)}&page=1`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setMovies(data.results || [])
        setTotalPages(data.total_pages || 1)
        setTotalResults(data.total_results || 0)
      }
    } catch (error) {
      console.error("Error searching movies:", error)
      toast({
        title: "Error",
        description: "Failed to search movies",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSearchPageChange(page: number) {
    if (!searchQuery.trim()) return

    setLoading(true)
    setCurrentPage(page)
    try {
      const response = await fetch(
        `/api/admin/tmdb/search-movies?query=${encodeURIComponent(searchQuery)}&page=${page}`,
        {
          credentials: "include",
        },
      )
      if (response.ok) {
        const data = await response.json()
        setMovies(data.results || [])
        setTotalPages(data.total_pages || 1)
        setTotalResults(data.total_results || 0)
      }
    } catch (error) {
      console.error("Error loading search page:", error)
    } finally {
      setLoading(false)
    }
  }

  function toggleMovieSelection(movieId: number) {
    const newSelection = new Set(selectedMovies)
    if (newSelection.has(movieId)) {
      newSelection.delete(movieId)
    } else {
      newSelection.add(movieId)
    }
    setSelectedMovies(newSelection)
  }

  function handleSelectAll() {
    const allMovieIds = movies.map((m) => m.id)
    setSelectedMovies(new Set(allMovieIds))
  }

  function handleDeselectAll() {
    setSelectedMovies(new Set())
  }

  async function handleBulkImport() {
    if (selectedMovies.size === 0) {
      toast({
        title: "No movies selected",
        description: "Please select at least one movie to import",
        variant: "destructive",
      })
      return
    }

    setImporting(true)
    try {
      const headers = await getAuthHeaders()
      
      // Create AbortController with 10 minute timeout (matching server maxDuration)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutes
      
      const response = await fetch("/api/admin/tmdb/bulk-import", {
        method: "POST",
        headers,
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          tmdb_ids: Array.from(selectedMovies),
          type: "movie",
          quality,
        }),
      })
      
      clearTimeout(timeoutId)

      let data
      try {
        const text = await response.text()
        if (!text) {
          throw new Error("Empty response from server")
        }
        data = JSON.parse(text)
      } catch (parseError) {
        console.error("[v0] Failed to parse bulk import response:", parseError)
        throw new Error(`Server returned invalid response (${response.status}). Please check server logs.`)
      }

      if (response.ok) {
        const importedCount = data.imported || 0
        const failedCount = data.failed || 0
        const skippedCount = data.skipped || 0
        const isPartial = data.partial || false
        const remaining = data.remaining || 0
        
        let description = `Successfully imported ${importedCount} movie${importedCount !== 1 ? "s" : ""}.`
        if (failedCount > 0) {
          description += ` ${failedCount} failed.`
        }
        if (isPartial && remaining > 0) {
          description += ` ${remaining} remaining (timeout). Please increase Nginx proxy_read_timeout or import in smaller batches.`
        } else if (skippedCount > 0) {
          description += ` ${skippedCount} skipped (limited to 100 per batch).`
        }

        toast({
          title: isPartial ? "Partial Import Complete" : "Import Complete",
          description,
          duration: isPartial ? 10000 : 5000,
          variant: isPartial ? "default" : "default",
        })
        
        if (importedCount > 0) {
          // Capture the successfully imported TMDB IDs from the response
          const importedTmdbIds = (data.results?.success || []).map((s: any) => s.tmdb_id).filter((id: number) => id)
          setSelectedMovies(new Set())
          
          // Wait for database to commit, then reload imported movies list
          // Use multiple retries to handle database visibility delay
          const retryLoad = async (attempt: number = 1, maxAttempts: number = 5) => {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)) // Progressive delay: 1s, 2s, 3s, etc.
            await loadImportedMovies()
            await checkImportedMovies()
            
            // If we still don't see all imported items and haven't exceeded max attempts, retry
            if (attempt < maxAttempts && importedTmdbIds.length > 0) {
              // Check if we're missing any of the successfully imported items
              const currentImported = Array.from(importedMovies)
              const missing = importedTmdbIds.filter((id: number) => !currentImported.includes(id))
              
              if (missing.length > 0) {
                console.log(`[v0] Still missing ${missing.length} imported items, retrying (attempt ${attempt + 1}/${maxAttempts})...`)
                retryLoad(attempt + 1, maxAttempts)
                return
              } else {
                console.log("[v0] All imported items are now visible")
              }
            }
            
            // Force a page refresh of the movie list to see new imports
            if (activeTab === "discover") {
              loadDiscoverMovies()
            }
          }
          
          // Start retry process
          retryLoad(1, 5)
        }
      } else {
        throw new Error(data.error || "Import failed")
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast({
          title: "Import Timeout",
          description: "The import took too long. Please check the server logs - the import may have completed on the server.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Import Failed",
          description: error instanceof Error ? error.message : "Failed to import selected movies",
          variant: "destructive",
        })
      }
    } finally {
      setImporting(false)
    }
  }

  async function handleSingleImport(movieId: number, title: string) {
    console.log("[v0] Starting import for movie:", movieId, title)
    setImportingMovieId(movieId)

    try {
      const payload = {
        tmdb_input: movieId.toString(),
        quality,
        contentType: "movie",
      }

      console.log("[v0] Calling import API with:", payload)

      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/import-tmdb", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      })

      console.log("[v0] Import API response status:", response.status)
      
      let data
      try {
        const text = await response.text()
        if (!text) {
          throw new Error("Empty response from server")
        }
        data = JSON.parse(text)
      } catch (parseError) {
        console.error("[v0] Failed to parse response:", parseError)
        throw new Error(`Server returned invalid response (${response.status}). Please check server logs.`)
      }
      
      console.log("[v0] Import API response data:", data)

      if (response.ok) {
        setImportedMovies((prev) => new Set(prev).add(movieId))
        toast({
          title: "??? Import Successful",
          description: `"${title}" has been imported successfully and is now available on your site`,
          duration: 5000,
        })
      } else {
        if (data.alreadyExists) {
          setImportedMovies((prev) => new Set(prev).add(movieId))
          toast({
            title: "Already Imported",
            description: data.error,
            variant: "default",
          })
        } else {
          throw new Error(data.error || "Import failed")
        }
      }
    } catch (error) {
      console.error("[v0] Import error:", error)
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import movie",
        variant: "destructive",
      })
    } finally {
      setImportingMovieId(null)
    }
  }

  function handleNewSearch() {
    setSearchQuery("")
    setCurrentPage(1)
    setMovies([])
    setTotalResults(0)
  }

  async function loadImportedMovies() {
    console.log("[v0] loadImportedMovies called")
    try {
      // Add cache-busting timestamp to force fresh query
      const cacheBuster = Date.now()
      const response = await fetch(`/api/admin/tmdb/imported-ids?type=movie&_t=${cacheBuster}`, {
        credentials: "include",
        cache: "no-store", // Disable browser caching
      })
      console.log("[v0] API response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Received imported movie IDs:", data.tmdb_ids)
        console.log("[v0] Number of imported movies:", data.tmdb_ids?.length || 0)

        const tmdbIds = Array.isArray(data.tmdb_ids)
          ? data.tmdb_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
          : []
        const importedSet: Set<number> = new Set(tmdbIds)
        console.log("[v0] Created Set with", importedSet.size, "imported movies")
        setImportedMovies(importedSet)
      } else {
        console.error("[v0] API returned error status:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error loading imported movies:", error)
    }
  }

  async function checkImportedMovies() {
    try {
      const tmdbIds = movies.map((m) => m.id)
      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/tmdb/check-imported", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ tmdb_ids: tmdbIds, type: "movie" }),
      })

      if (response.ok) {
        const data = await response.json()
        const importedIds = Array.isArray(data.imported_ids)
          ? data.imported_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
          : []
        setImportedMovies(new Set<number>(importedIds))
      }
    } catch (error) {
      console.error("[v0] Error checking imported movies:", error)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.push("/arike/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
              Movies Discover
            </h1>
            <p className="text-muted-foreground text-sm">Browse and import movies from TMDB</p>
          </div>
          <Badge variant={apiStatus === "online" ? "default" : "destructive"} className="gap-2">
            <div className={`w-2 h-2 rounded-full ${apiStatus === "online" ? "bg-green-500" : "bg-red-500"}`} />
            Status API is {apiStatus === "checking" ? "Checking..." : apiStatus === "online" ? "Online" : "Offline"}
          </Badge>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 bg-gradient-to-r from-pink-500/10 to-pink-600/10 border-pink-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-center">
              NFM, Our Import Tool To Make It Easier To Retrieve Data Info Via Imdb Or Tmdb. It Also Underwent A Very
              Important Change, Providing Better Access To A Large Number Of Content Such As Movies, Dramas, Anime,
              Series, And Others.
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Search Movies</CardTitle>
                <CardDescription>Search for specific movies by title</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter movie title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    SEARCH
                  </Button>
                  {searchQuery && (
                    <Button
                      type="button"
                      onClick={handleNewSearch}
                      variant="outline"
                      className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                    >
                      NEW SEARCH
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>

            {totalResults > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Results: {totalResults.toLocaleString()} movies found
              </div>
            )}
          </TabsContent>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            <div className="flex justify-between items-start gap-6">
              <div className="flex-1">
                {totalResults > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Results: Page {currentPage} ??? {totalResults.toLocaleString()} movies found
                  </div>
                )}
              </div>

              {/* Filters Sidebar */}
              <Card className="w-80">
                <CardHeader>
                  <CardTitle>Movie Discover</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Year Filter */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setYear((Number.parseInt(year) - 1).toString())}
                    >
                      -
                    </Button>
                    <span className="text-2xl font-bold">{year}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setYear((Number.parseInt(year) + 1).toString())}
                    >
                      +
                    </Button>
                  </div>

                  {/* Sort By */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity.desc">Popularity desc</SelectItem>
                      <SelectItem value="popularity.asc">Popularity asc</SelectItem>
                      <SelectItem value="vote_average.desc">Rating desc</SelectItem>
                      <SelectItem value="vote_average.asc">Rating asc</SelectItem>
                      <SelectItem value="release_date.desc">Release date desc</SelectItem>
                      <SelectItem value="release_date.asc">Release date asc</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Genre Filter */}
                  <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="All genres" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All genres</SelectItem>
                      {genres.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id.toString()}>
                          {genre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Quality */}
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAM">CAM</SelectItem>
                      <SelectItem value="HD">HD</SelectItem>
                      <SelectItem value="FHD">FHD</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => {
                      setYear(new Date().getFullYear().toString())
                      setSelectedGenre("all")
                      setSortBy("popularity.desc")
                      setCurrentPage(1)
                    }}
                    variant="outline"
                    className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Reset Filters
                  </Button>

                  <Button onClick={loadDiscoverMovies} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                    <Search className="h-4 w-4" />
                    NEW SEARCH
                  </Button>

                  {movies.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSelectAll}
                        variant="outline"
                        className="flex-1 gap-2 bg-transparent"
                        disabled={selectedMovies.size === movies.length}
                      >
                        <Checkbox checked={selectedMovies.size === movies.length} className="pointer-events-none" />
                        Select All
                      </Button>
                      <Button
                        onClick={handleDeselectAll}
                        variant="outline"
                        className="flex-1 bg-transparent"
                        disabled={selectedMovies.size === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  )}

                  {selectedMovies.size > 0 && (
                    <Button
                      onClick={handleBulkImport}
                      disabled={importing}
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Bulk Import ({selectedMovies.size})
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Movies Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : movies.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-6">
              {movies.map((movie) => (
                <Card key={movie.id} className="group relative overflow-hidden">
                  <div className="relative aspect-[2/3]">
                    <Image
                      src={
                        movie.poster_path
                          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                          : "/placeholder.svg?height=450&width=300"
                      }
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                      <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">{movie.title}</h3>
                      <p className="text-white/80 text-xs mb-3">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : "N/A"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSingleImport(movie.id, movie.title)}
                          disabled={importingMovieId === movie.id || importedMovies.has(movie.id)}
                          className={`gap-1 ${importedMovies.has(movie.id) ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {importingMovieId === movie.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Importing...
                            </>
                          ) : importedMovies.has(movie.id) ? (
                            <>
                              <Check className="h-3 w-3" />
                              Imported
                            </>
                          ) : (
                            <>
                              <Download className="h-3 w-3" />
                              Import
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {activeTab === "discover" && (
                      <div className="absolute top-2 left-2">
                        <Checkbox
                          checked={selectedMovies.has(movie.id)}
                          onCheckedChange={() => toggleMovieSelection(movie.id)}
                          className="bg-white"
                        />
                      </div>
                    )}
                    {importedMovies.has(movie.id) && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-600 text-white">
                          <Check className="h-3 w-3 mr-1" />
                          Imported
                        </Badge>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (activeTab === "search") {
                      handleSearchPageChange(currentPage - 1)
                    } else {
                      setCurrentPage(currentPage - 1)
                    }
                  }}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (activeTab === "search") {
                      handleSearchPageChange(currentPage + 1)
                    } else {
                      setCurrentPage(currentPage + 1)
                    }
                  }}
                  disabled={currentPage === totalPages}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  NEXT
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            {activeTab === "search" ? "Enter a search query to find movies" : "No movies found"}
          </div>
        )}
      </main>
    </div>
  )
}
