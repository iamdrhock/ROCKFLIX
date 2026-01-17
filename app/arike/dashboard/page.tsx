"use client"

import type React from "react"
import { ClientHeader } from "@/components/client-header"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminSession } from "@/hooks/use-admin-session"
import { getAuthHeaders } from "@/lib/utils/csrf"
import {
  Film,
  Tv,
  Eye,
  MessageSquare,
  Plus,
  LogOut,
  Layers,
  PlaySquare,
  Megaphone,
  Settings,
  BarChart3,
  Users,
  Flag,
  Download,
  Zap,
  Database,
  Bell,
} from "lucide-react"

interface Stats {
  total_movies: number
  total_series: number
  total_seasons: number
  total_episodes: number
  total_views: number
  total_comments: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [statsKey, setStatsKey] = useState(0) // Force re-render key
  const [importId, setImportId] = useState("")
  const [quality, setQuality] = useState("HD")
  const [importSource, setImportSource] = useState<"omdb" | "tmdb">("tmdb")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const router = useRouter()
  const { loading: authLoading } = useAdminSession()

  useEffect(() => {
    // Load stats when auth is ready
    if (!authLoading) {
      console.log("[v0] Auth loading complete, calling loadStats...")
      loadStats()
    } else {
      console.log("[v0] Auth still loading, waiting...")
    }
  }, [authLoading])

  // Also try to load stats after a short delay as a fallback (in case authLoading is stuck)
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (statsLoading && stats === null && !statsError) {
        console.log("[v0] Fallback: Loading stats after 2 second delay (auth may be stuck)")
        loadStats()
      }
    }, 2000)

    return () => clearTimeout(fallbackTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadStats() {
    setStatsLoading(true)
    setStatsError(null)
    
    // Add timeout to prevent hanging
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout | null = null
    
    try {
      timeoutId = setTimeout(() => {
        console.error("[v0] Stats API request timeout after 10 seconds")
        controller.abort()
      }, 10000) // 10 second timeout
      
      console.log("[v0] Fetching admin stats from /api/admin/stats...")
      
      const startTime = Date.now()
      // Add cache-busting timestamp to ensure fresh data
      const response = await fetch(`/api/admin/stats?t=${Date.now()}`, {
        credentials: "include",
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      })
      
      const fetchTime = Date.now() - startTime
      console.log(`[v0] Stats API response received in ${fetchTime}ms, status:`, response.status)
      
      if (timeoutId) clearTimeout(timeoutId)

      // Check if response is ok
      if (!response.ok) {
        let errorText = ""
        try {
          errorText = await response.text()
          console.error("[v0] Stats API error response:", errorText)
        } catch {
          errorText = response.statusText || "Unknown error"
        }
        
        let errorData
        try {
          errorData = errorText ? JSON.parse(errorText) : { error: `HTTP ${response.status}` }
        } catch {
          errorData = { error: `HTTP ${response.status}: ${errorText || response.statusText}` }
        }
        
        console.error("[v0] Stats API failed:", response.status, errorData)
        setStatsError(errorData.error || `Failed to load stats (${response.status})`)
        
        // Set default stats even on error
        setStats({
          total_movies: 0,
          total_series: 0,
          total_seasons: 0,
          total_episodes: 0,
          total_views: 0,
          total_comments: 0,
        })
        setStatsLoading(false)
        return
      }

      // Parse response
      let data
      try {
        const text = await response.text()
        console.log("[v0] Stats API response text length:", text.length)
        
        if (!text || text.trim() === "") {
          console.error("[v0] Empty response from stats API")
          throw new Error("Empty response from server")
        }
        
        data = JSON.parse(text)
        console.log("[v0] Stats API response parsed successfully:", data)
      } catch (parseError) {
        console.error("[v0] Failed to parse stats response:", parseError)
        setStatsError("Invalid response from server")
        setStats({
          total_movies: 0,
          total_series: 0,
          total_seasons: 0,
          total_episodes: 0,
          total_views: 0,
          total_comments: 0,
        })
        setStatsLoading(false)
        return
      }
      
      // Validate data structure
      if (!data || typeof data !== "object") {
        console.error("[v0] Invalid stats data structure:", data)
        setStatsError("Invalid data structure from server")
        setStats({
          total_movies: 0,
          total_series: 0,
          total_seasons: 0,
          total_episodes: 0,
          total_views: 0,
          total_comments: 0,
        })
        setStatsLoading(false)
        return
      }
      
      console.log("[v0] Setting stats:", data)
      
      // Ensure all required fields are present
      const newStats = {
        total_movies: typeof data.total_movies === "number" ? data.total_movies : 0,
        total_series: typeof data.total_series === "number" ? data.total_series : 0,
        total_seasons: typeof data.total_seasons === "number" ? data.total_seasons : 0,
        total_episodes: typeof data.total_episodes === "number" ? data.total_episodes : 0,
        total_views: typeof data.total_views === "number" ? data.total_views : 0,
        total_comments: typeof data.total_comments === "number" ? data.total_comments : 0,
      }
      
      setStats(newStats)
      setStatsKey(prev => prev + 1) // Force re-render
      console.log("[v0] Stats successfully set:", newStats)
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      
      console.error("[v0] Exception loading stats:", error)
      console.error("[v0] Error details:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      
      if (error instanceof Error && error.name === "AbortError") {
        setStatsError("Request timeout - stats API took too long to respond (10s)")
      } else if (error instanceof Error && error.message) {
        setStatsError(error.message)
      } else {
        setStatsError("Failed to load stats - check console for details")
      }
      
      // Set default stats to show section even if API fails
      setStats({
        total_movies: 0,
        total_series: 0,
        total_seasons: 0,
        total_episodes: 0,
        total_views: 0,
        total_comments: 0,
      })
    } finally {
      console.log("[v0] Stats loading complete, setting loading to false")
      setStatsLoading(false)
    }
  }

  async function handleUpdateTrailers() {
    setLoading(true)
    setMessage("")
    
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch("/api/admin/tmdb/update-trailers", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          type: "all", // Update both movies and series
          limit: 200, // Update 200 at a time (increased from 100)
        }),
      })

      // Check if response is actually JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("[v0] Non-JSON response:", text.substring(0, 200))
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Check if the route exists.`)
      }

      const data = await response.json()

      if (response.ok) {
        const { updated, failed, skipped, total, totalRemaining } = data
        const message = `Trailers updated! ${updated} updated, ${failed} failed, ${skipped} skipped (no trailer available), ${total} total processed.${totalRemaining > 0 ? ` ${totalRemaining} remaining.` : ''}`
        setMessage(message)
        
        // If there are more to update, suggest running again
        if (totalRemaining > 0) {
          setTimeout(() => {
            if (confirm(`Updated ${updated} trailers. ${totalRemaining} items still need trailers. Run again to update more?`)) {
              handleUpdateTrailers()
            }
          }, 2000)
        } else if (total >= 200) {
          // Fallback: if totalRemaining not available but we processed a full batch
          setTimeout(() => {
            if (confirm(`Updated ${updated} trailers. There may be more. Run again to update more?`)) {
              handleUpdateTrailers()
            }
          }, 2000)
        }
      } else {
        setMessage(`Error: ${data.error || "Failed to update trailers"}`)
      }
    } catch (error: any) {
      console.error("[v0] Error updating trailers:", error)
      setMessage(`Error: ${error.message || "Failed to update trailers"}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    setLoading(true)

    try {
      const endpoint = importSource === "tmdb" ? "/api/admin/import-tmdb" : "/api/admin/import-imdb"

      const requestBody = importSource === "tmdb" ? { tmdb_input: importId, quality } : { imdb_id: importId, quality }

      const headers = await getAuthHeaders()
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(requestBody),
      })

      let data
      try {
        const text = await response.text()
        if (!text) {
          throw new Error("Empty response from server")
        }
        data = JSON.parse(text)
      } catch (parseError) {
        console.error("[import] Failed to parse response:", parseError)
        throw new Error(`Server returned invalid response (${response.status}). Please check server logs.`)
      }

      if (response.ok) {
        if (data.type === "series") {
          setMessage(
            `Success! "${data.title}" has been imported with ${data.seasons_imported} seasons and ${data.episodes_imported} episodes.`,
          )
        } else {
          setMessage(`Success! "${data.title}" has been imported.`)
        }
        setImportId("")
        loadStats()
      } else {
        console.error("[import] Import failed:", response.status, data)
        setMessage(`Error: ${data.error || "Import failed"}`)
      }
    } catch (error) {
      console.error("[import] Import error:", error)
      setMessage(`Connection error: ${error instanceof Error ? error.message : "Please try again."}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { 
        method: "POST",
        credentials: "include",
      })
      // Add logout flag to prevent redirect loop
      router.replace("/arike?logout=true")
    } catch (error) {
      console.error("[admin] Logout error:", error)
      // Still redirect even if logout fails
      router.replace("/arike?logout=true")
    }
  }

  return (
    <div className="min-h-screen flex flex-col" data-admin-panel>
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/arike/talkflix/posts")}
              className="gap-2 bg-transparent"
            >
              <MessageSquare className="h-4 w-4" />
              TalkFlix Posts
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/talkflix/users")}
              className="gap-2 bg-transparent"
            >
              <Users className="h-4 w-4" />
              TalkFlix Users
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/talkflix/reports")}
              className="gap-2 bg-transparent"
            >
              <Flag className="h-4 w-4" />
              Reports
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/talkflix/settings")}
              className="gap-2 bg-transparent"
            >
              <Settings className="h-4 w-4" />
              TalkFlix Settings
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/analytics")} className="gap-2 bg-transparent">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/import-movies")}
              className="gap-2 bg-transparent"
            >
              <Film className="h-4 w-4" />
              Import Movies
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/import-series")}
              className="gap-2 bg-transparent"
            >
              <Tv className="h-4 w-4" />
              Import Series
            </Button>
            <Button
              variant="outline"
              onClick={handleUpdateTrailers}
              className="gap-2 bg-transparent"
              disabled={loading}
            >
              {loading ? <Zap className="h-4 w-4 animate-spin" /> : <PlaySquare className="h-4 w-4" />}
              Update Trailers
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/push-notifications")}
              className="gap-2 bg-transparent"
            >
              <Bell className="h-4 w-4" />
              Push Notifications
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/users")} className="gap-2 bg-transparent">
              <Settings className="h-4 w-4" />
              Manage Users
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/blog")} className="gap-2 bg-transparent">
              <MessageSquare className="h-4 w-4" />
              Manage Blog
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/pages")} className="gap-2 bg-transparent">
              <Settings className="h-4 w-4" />
              Manage Pages
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/manage-content")}
              className="gap-2 bg-transparent"
            >
              <Settings className="h-4 w-4" />
              Manage Content
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/download-links")}
              className="gap-2 bg-transparent"
            >
              <Download className="h-4 w-4" />
              Download Links
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/players")} className="gap-2 bg-transparent">
              <PlaySquare className="h-4 w-4" />
              Players
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/advert")} className="gap-2 bg-transparent">
              <Megaphone className="h-4 w-4" />
              Advert
            </Button>
            <Button variant="outline" onClick={() => router.push("/arike/settings")} className="gap-2 bg-transparent">
              <Settings className="h-4 w-4" />
              Site Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/arike/migrate-database")}
              className="gap-2 bg-transparent"
            >
              <Database className="h-4 w-4" />
              Migrate DB
            </Button>
            {/* Adding optimization settings button */}
            <Button
              variant="outline"
              onClick={() => router.push("/arike/optimization")}
              className="gap-2 bg-transparent"
            >
              <Zap className="h-4 w-4" />
              Performance
            </Button>
            <Button variant="outline" onClick={handleLogout} className="gap-2 bg-transparent">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Section - Always show, even if loading or failed */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8" key={`stats-grid-${statsKey}`}>
          {statsLoading ? (
            // Loading state
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                  <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold animate-pulse bg-muted h-8 w-16 rounded" />
                </CardContent>
              </Card>
            ))
          ) : stats ? (
            // Stats display
            <>
            <Card key="movies">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Movies</CardTitle>
                <Film className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_movies}</div>
              </CardContent>
            </Card>

            <Card key="series">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Series</CardTitle>
                <Tv className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_series}</div>
              </CardContent>
            </Card>

            <Card key="seasons">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Seasons</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_seasons}</div>
              </CardContent>
            </Card>

            <Card key="episodes">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Episodes</CardTitle>
                <PlaySquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_episodes}</div>
              </CardContent>
            </Card>

            <Card key="views">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_views.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card key="comments">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comments</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_comments}</div>
              </CardContent>
            </Card>
            </>
          ) : (
            // Error state - still show cards with error message
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Movies</CardTitle>
                  <Film className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-destructive mt-1">{statsError}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Series</CardTitle>
                  <Tv className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-destructive mt-1">{statsError}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Seasons</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-destructive mt-1">{statsError}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Episodes</CardTitle>
                  <PlaySquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-destructive mt-1">{statsError}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-destructive mt-1">{statsError}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comments</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-destructive mt-1">{statsError}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Import Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Import Movie/Series
            </CardTitle>
            <CardDescription>
              Enter a TMDB URL (e.g., themoviedb.org/tv/71912 or themoviedb.org/movie/12345) or IMDB ID (e.g.,
              tt1234567) to automatically import movie or TV series details with all seasons and episodes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImport} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="import_id">{importSource === "tmdb" ? "TMDB URL or ID" : "IMDB ID"}</Label>
                  <Input
                    id="import_id"
                    type="text"
                    value={importId}
                    onChange={(e) => setImportId(e.target.value)}
                    placeholder={
                      importSource === "tmdb" ? "https://www.themoviedb.org/tv/71912-the-witcher" : "tt1234567"
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {importSource === "tmdb"
                      ? "Paste full TMDB URL or just the ID number"
                      : "Find the IMDB ID in the URL: imdb.com/title/tt1234567"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import_source">Import Source</Label>
                  <Select value={importSource} onValueChange={(value: "omdb" | "tmdb") => setImportSource(value)}>
                    <SelectTrigger id="import_source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tmdb">TMDB (Recommended)</SelectItem>
                      <SelectItem value="omdb">OMDB</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">TMDB provides more complete episode data</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quality">Quality</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger id="quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAM">CAM</SelectItem>
                      <SelectItem value="HD">HD</SelectItem>
                      <SelectItem value="FHD">FHD</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {message && (
                <p className={`text-sm ${message.startsWith("Success") ? "text-primary" : "text-destructive"}`}>
                  {message}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full md:w-auto">
                {loading ? "Importing..." : "Import Movie/Series"}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Important Setup Note:</h3>
              <p className="text-sm text-muted-foreground">To use the import features, you need API keys:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside mt-2 space-y-2">
                <li>
                  <strong>TMDB (Recommended):</strong> Get a free API key from{" "}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    themoviedb.org
                  </a>{" "}
                  and add it as <code className="bg-background px-1 rounded">TMDB_API_KEY</code> environment variable
                </li>
                <li>
                  <strong>OMDB (Alternative):</strong> Get a free API key from{" "}
                  <a
                    href="https://www.omdbapi.com/apikey.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    omdbapi.com
                  </a>{" "}
                  (already configured with a demo key)
                </li>
              </ol>
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">Example TMDB URLs:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>??? Movie: https://www.themoviedb.org/movie/9737-bad-boys</li>
                  <li>??? TV Series: https://www.themoviedb.org/tv/71912-the-witcher</li>
                </ul>
              </div>
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  <strong>?????? Note:</strong> OMDB sometimes has incomplete episode data, especially for newer seasons. If
                  you're missing episodes, use TMDB instead for more complete and up-to-date information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
