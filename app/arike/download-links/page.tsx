"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Edit, Trash2, Film, Tv, LinkIcon, Search, ChevronLeft, ChevronRight } from "lucide-react"

interface DownloadLink {
  id: number
  movie_id: number
  episode_id?: number | null
  quality: string
  format: string
  link_url: string
  provider: string
  file_size: string
  status: string
  created_at: string
  movies?: { id: number; title: string; type: string }
  episodes?: {
    id: number
    title: string
    episode_number: number
    seasons: { season_number: number }
  }
}

interface Movie {
  id: number
  title: string
  type: string
  seasons?: { id: number; season_number: number; episodes: { id: number; episode_number: number; title: string }[] }[]
}

export default function DownloadLinksPage() {
  const [links, setLinks] = useState<DownloadLink[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingLink, setEditingLink] = useState<DownloadLink | null>(null)
  const [deletingLink, setDeletingLink] = useState<DownloadLink | null>(null)
  const [message, setMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const router = useRouter()

  // Form fields
  const [movieSearch, setMovieSearch] = useState("")
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [quality, setQuality] = useState("720p")
  const [format, setFormat] = useState("MP4")
  const [linkUrl, setLinkUrl] = useState("")
  const [provider, setProvider] = useState("")
  const [fileSize, setFileSize] = useState("")

  useEffect(() => {
    // Check admin session via API instead of localStorage
    async function checkAuth() {
      try {
        await fetchCsrfToken().catch(console.error)
        const response = await fetch("/api/admin/session", { 
          credentials: "include",
          cache: "no-store",
        })
        if (!response.ok) {
          router.push("/arike")
          return
        }
        loadLinks()
      } catch (error) {
        console.error("[admin] Auth check failed:", error)
        router.push("/arike")
      }
    }
    checkAuth()
  }, [router])

  async function loadLinks(page: number = currentPage, search: string = searchQuery) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "30",
      })
      if (search.trim()) {
        params.append("search", search.trim())
      }
      
      console.log("[download-links] Fetching download links...", params.toString())
      const response = await fetch(`/api/admin/download-links?${params.toString()}`)
      console.log("[download-links] Response status:", response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log("[download-links] Response data:", result)
        console.log("[download-links] Links array:", result.data)
        console.log("[download-links] Links count:", result.data?.length || 0)
        setLinks(result.data || [])
        
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages || 1)
          setTotal(result.pagination.total || 0)
          setCurrentPage(result.pagination.page || 1)
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[download-links] Error response:", errorData)
        setMessage(`Error loading links: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("[download-links] Error loading download links:", error)
      setMessage("Failed to load download links")
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (searchQuery === undefined) return // Skip initial render
    
    const timer = setTimeout(() => {
      setCurrentPage(1) // Reset to first page on search
      loadLinks(1, searchQuery)
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  async function searchMovies(query: string) {
    if (!query.trim()) {
      setMovies([])
      return
    }

    try {
      const response = await fetch(`/api/admin/content?search=${encodeURIComponent(query)}&limit=10`)
      if (response.ok) {
        const result = await response.json()
        console.log("[v0] Fetched movies with details:", result.data)
        setMovies(result.data || [])
      }
    } catch (error) {
      console.error("[v0] Error searching movies:", error)
    }
  }

  function openAddDialog() {
    resetForm()
    setShowAddDialog(true)
    setMessage("")
  }

  function openEditDialog(link: DownloadLink) {
    setEditingLink(link)
    setQuality(link.quality)
    setFormat(link.format)
    setLinkUrl(link.link_url)
    setProvider(link.provider || "")
    setFileSize(link.file_size || "")
    setMessage("")
  }

  function resetForm() {
    setSelectedMovie(null)
    setSelectedSeason(null)
    setSelectedEpisode(null)
    setQuality("720p")
    setFormat("MP4")
    setLinkUrl("")
    setProvider("")
    setFileSize("")
    setMovieSearch("")
    setMovies([])
  }

  async function handleAdd() {
    if (!selectedMovie || !linkUrl.trim()) {
      setMessage("Error: Please select a movie and provide a download link")
      return
    }

    // For series, episode must be selected
    if (selectedMovie.type === "series" && !selectedEpisode) {
      setMessage("Error: Please select an episode for this series")
      return
    }

    try {
      const requestBody: any = {
        movie_id: selectedMovie.id,
        quality,
        format,
        link_url: linkUrl,
        provider,
        file_size: fileSize,
        uploaded_by: "admin",
      }

      // Only add episode_id for series
      if (selectedMovie.type === "series" && selectedEpisode) {
        requestBody.episode_id = selectedEpisode
      }

      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/download-links", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        setMessage("Download link added successfully!")
        setShowAddDialog(false)
        resetForm()
        loadLinks(currentPage, searchQuery)
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to add download link")
    }
  }

  async function handleUpdate() {
    if (!editingLink) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/download-links/${editingLink.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          quality,
          format,
          link_url: linkUrl,
          provider,
          file_size: fileSize,
        }),
      })

      if (response.ok) {
        setMessage("Download link updated successfully!")
        setEditingLink(null)
        loadLinks(currentPage, searchQuery)
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to update download link")
    }
  }

  async function handleDelete() {
    if (!deletingLink) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/download-links/${deletingLink.id}`, {
        method: "DELETE",
        headers,
      })

      if (response.ok) {
        setMessage("Download link deleted successfully!")
        setDeletingLink(null)
        loadLinks(currentPage, searchQuery)
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to delete download link")
    }
  }

  const currentSeasonEpisodes =
    selectedMovie?.type === "series" && selectedSeason
      ? selectedMovie.seasons?.find((s) => s.season_number === selectedSeason)?.episodes || []
      : []

  return (
    <div className="min-h-screen flex flex-col">
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/arike/dashboard")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Download Links</h1>
          </div>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Download Link
          </Button>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${message.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
          >
            {message}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by movie title, quality, format, provider, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-muted-foreground">
              Showing results for "{searchQuery}" ({total} {total === 1 ? 'link' : 'links'})
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            <div className="grid gap-4">
            {links.map((link) => (
              <Card key={link.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {link.movies?.type === "movie" ? (
                          <Film className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Tv className="h-4 w-4 text-muted-foreground" />
                        )}
                        <h3 className="font-semibold">{link.movies?.title}</h3>
                        {link.episodes && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            S{link.episodes.seasons.season_number}E{link.episodes.episode_number}
                            {link.episodes.title ? ` - ${link.episodes.title}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="bg-muted px-2 py-1 rounded">{link.quality}</span>
                        <span className="bg-muted px-2 py-1 rounded">{link.format}</span>
                        {link.file_size && <span className="bg-muted px-2 py-1 rounded">{link.file_size}</span>}
                        {link.provider && <span className="bg-muted px-2 py-1 rounded">{link.provider}</span>}
                        <span
                          className={`px-2 py-1 rounded ${link.status === "active" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                        >
                          {link.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <LinkIcon className="h-3 w-3" />
                        <a
                          href={link.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-primary transition-colors max-w-md"
                        >
                          {link.link_url}
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(link)} className="gap-2">
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingLink(link)}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing page {currentPage} of {totalPages} ({total} total {total === 1 ? 'link' : 'links'})
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = currentPage - 1
                      setCurrentPage(newPage)
                      loadLinks(newPage, searchQuery)
                    }}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setCurrentPage(pageNum)
                            loadLinks(pageNum, searchQuery)
                          }}
                          disabled={loading}
                          className="min-w-[40px]"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = currentPage + 1
                      setCurrentPage(newPage)
                      loadLinks(newPage, searchQuery)
                    }}
                    disabled={currentPage === totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!loading && links.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery 
                  ? `No download links found matching "${searchQuery}". Try a different search term.`
                  : 'No download links found. Click "Add Download Link" to create one.'}
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Download Link</DialogTitle>
            <DialogDescription>Add a new download link for a movie or episode</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Movie Search */}
            <div className="space-y-2">
              <Label htmlFor="movie-search">Search Movie/Series</Label>
              <Input
                id="movie-search"
                placeholder="Type to search..."
                value={movieSearch}
                onChange={(e) => {
                  setMovieSearch(e.target.value)
                  searchMovies(e.target.value)
                }}
              />
              {movies.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {movies.map((movie) => (
                    <button
                      key={movie.id}
                      onClick={() => {
                        setSelectedMovie(movie)
                        setMovieSearch(movie.title)
                        setMovies([])
                        setSelectedSeason(null)
                        setSelectedEpisode(null)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      {movie.type === "movie" ? (
                        <Film className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Tv className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{movie.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{movie.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Series Episode Selection */}
            {selectedMovie?.type === "series" && selectedMovie.seasons && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="season">Season</Label>
                  <Select
                    value={selectedSeason?.toString() || ""}
                    onValueChange={(value) => {
                      setSelectedSeason(Number.parseInt(value))
                      setSelectedEpisode(null)
                    }}
                  >
                    <SelectTrigger id="season">
                      <SelectValue placeholder="Select season" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMovie.seasons.map((season) => (
                        <SelectItem key={season.id} value={season.season_number.toString()}>
                          Season {season.season_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSeason && currentSeasonEpisodes.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="episode">Episode</Label>
                    <Select
                      value={selectedEpisode?.toString() || ""}
                      onValueChange={(value) => setSelectedEpisode(Number.parseInt(value))}
                    >
                      <SelectTrigger id="episode">
                        <SelectValue placeholder="Select episode" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentSeasonEpisodes.map((episode) => (
                          <SelectItem key={episode.id} value={episode.id.toString()}>
                            Episode {episode.episode_number}
                            {episode.title ? ` - ${episode.title}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* Quality */}
            <div className="space-y-2">
              <Label htmlFor="quality">Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="360p">360p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="4K">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MP4">MP4</SelectItem>
                  <SelectItem value="MKV">MKV</SelectItem>
                  <SelectItem value="AVI">AVI</SelectItem>
                  <SelectItem value="MOV">MOV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Download Link URL */}
            <div className="space-y-2">
              <Label htmlFor="link-url">Download Link URL</Label>
              <Input
                id="link-url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider (Optional)</Label>
              <Input
                id="provider"
                placeholder="Google Drive, Mega, Dropbox, etc."
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              />
            </div>

            {/* File Size */}
            <div className="space-y-2">
              <Label htmlFor="file-size">File Size (Optional)</Label>
              <Input
                id="file-size"
                placeholder="500MB, 2GB, etc."
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Download Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Download Link</DialogTitle>
            <DialogDescription>Update download link details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-quality">Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger id="edit-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="360p">360p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="4K">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="edit-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MP4">MP4</SelectItem>
                  <SelectItem value="MKV">MKV</SelectItem>
                  <SelectItem value="AVI">AVI</SelectItem>
                  <SelectItem value="MOV">MOV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-link-url">Download Link URL</Label>
              <Input
                id="edit-link-url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-provider">Provider</Label>
              <Input
                id="edit-provider"
                placeholder="Google Drive, Mega, etc."
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-file-size">File Size</Label>
              <Input
                id="edit-file-size"
                placeholder="500MB, 2GB, etc."
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLink(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingLink} onOpenChange={(open) => !open && setDeletingLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this download link. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
