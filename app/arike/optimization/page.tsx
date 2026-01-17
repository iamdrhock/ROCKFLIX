"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, RefreshCw, Database, Zap, TrendingUp, Trash2 } from "lucide-react"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"

interface OptimizationSettings {
  cache_enabled: boolean
  cache_ttl_movies: number
  cache_ttl_trending: number
  cache_ttl_genres: number
  max_items_per_page: number
  enable_lazy_loading: boolean
  compress_images: boolean
}

interface CacheStats {
  enabled: boolean
  total_keys?: number
  movie_cache?: number
  trending_cache?: number
  genre_cache?: number
  message?: string
}

export default function OptimizationPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<OptimizationSettings | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("success")

  useEffect(() => {
    fetchSettings()
    fetchCacheStats()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings({
          cache_enabled: data.cache_enabled ?? true,
          cache_ttl_movies: data.cache_ttl_movies ?? 300,
          cache_ttl_trending: data.cache_ttl_trending ?? 180,
          cache_ttl_genres: data.cache_ttl_genres ?? 600,
          max_items_per_page: data.max_items_per_page ?? 24,
          enable_lazy_loading: data.enable_lazy_loading ?? true,
          compress_images: data.compress_images ?? true,
        })
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCacheStats = async () => {
    try {
      const response = await fetch("/api/admin/cache/stats")
      if (response.ok) {
        const data = await response.json()
        setCacheStats(data)
      }
    } catch (error) {
      console.error("Error fetching cache stats:", error)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setMessageType("success")
        setMessage("Settings saved successfully!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessageType("error")
        setMessage("Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      setMessageType("error")
      setMessage("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleClearCache = async (pattern = "*") => {
    setClearing(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/cache/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.redis_configured === false) {
          setMessageType("info")
          setMessage(
            "Redis caching is not configured. To enable caching, add Upstash Redis integration from the Connect section in the sidebar.",
          )
        } else {
          setMessageType("success")
          setMessage(`Successfully cleared ${data.keys_cleared} cache key(s)`)
        }
        fetchCacheStats()
        setTimeout(() => setMessage(""), 5000)
      } else {
        setMessageType("error")
        setMessage("Failed to clear cache")
      }
    } catch (error) {
      console.error("Error clearing cache:", error)
      setMessageType("error")
      setMessage("Failed to clear cache")
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading settings...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Failed to load settings</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/arike/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Performance Optimization</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            messageType === "success"
              ? "bg-primary/10 text-primary border border-primary/20"
              : messageType === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6">
        {/* Cache Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Management
            </CardTitle>
            <CardDescription>Control caching behavior to reduce database load and improve performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cache_enabled">Enable Caching</Label>
                <p className="text-sm text-muted-foreground">
                  Use Redis to cache frequently accessed data (requires Upstash Redis)
                </p>
              </div>
              <Switch
                id="cache_enabled"
                checked={settings.cache_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, cache_enabled: checked })}
              />
            </div>

            {cacheStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-2xl font-bold">{cacheStats.enabled ? "Active" : "Inactive"}</div>
                  <div className="text-xs text-muted-foreground">Cache Status</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{cacheStats.total_keys || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Keys</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{cacheStats.movie_cache || 0}</div>
                  <div className="text-xs text-muted-foreground">Movie Cache</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{cacheStats.trending_cache || 0}</div>
                  <div className="text-xs text-muted-foreground">Trending Cache</div>
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Cache Expiration Times (in seconds)</h3>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cache_ttl_movies">Movies & Series Cache (Default: 300s / 5min)</Label>
                  <Input
                    id="cache_ttl_movies"
                    type="number"
                    value={settings.cache_ttl_movies}
                    onChange={(e) =>
                      setSettings({ ...settings, cache_ttl_movies: Number.parseInt(e.target.value) || 300 })
                    }
                    placeholder="300"
                  />
                  <p className="text-xs text-muted-foreground">How long to cache movie and series data</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache_ttl_trending">Trending Content Cache (Default: 180s / 3min)</Label>
                  <Input
                    id="cache_ttl_trending"
                    type="number"
                    value={settings.cache_ttl_trending}
                    onChange={(e) =>
                      setSettings({ ...settings, cache_ttl_trending: Number.parseInt(e.target.value) || 180 })
                    }
                    placeholder="180"
                  />
                  <p className="text-xs text-muted-foreground">How long to cache trending movies/posts</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache_ttl_genres">Genre & Category Cache (Default: 600s / 10min)</Label>
                  <Input
                    id="cache_ttl_genres"
                    type="number"
                    value={settings.cache_ttl_genres}
                    onChange={(e) =>
                      setSettings({ ...settings, cache_ttl_genres: Number.parseInt(e.target.value) || 600 })
                    }
                    placeholder="600"
                  />
                  <p className="text-xs text-muted-foreground">How long to cache genres and categories</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold mb-2">Clear Cache</h3>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClearCache("movie:*")}
                  disabled={clearing}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Movies
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClearCache("trending:*")}
                  disabled={clearing}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Trending
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClearCache("genre:*")}
                  disabled={clearing}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Genres
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleClearCache("*")}
                  disabled={clearing}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All Cache
                </Button>
                <Button variant="outline" size="sm" onClick={fetchCacheStats} className="gap-2 ml-auto bg-transparent">
                  <RefreshCw className="h-4 w-4" />
                  Refresh Stats
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Settings
            </CardTitle>
            <CardDescription>Configure performance optimizations for your site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="max_items_per_page">Items Per Page</Label>
              <Input
                id="max_items_per_page"
                type="number"
                value={settings.max_items_per_page}
                onChange={(e) =>
                  setSettings({ ...settings, max_items_per_page: Number.parseInt(e.target.value) || 24 })
                }
                placeholder="24"
              />
              <p className="text-sm text-muted-foreground">
                Number of movies/series to display per page (Lower = faster loading)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable_lazy_loading">Enable Lazy Loading</Label>
                <p className="text-sm text-muted-foreground">Load images only when they're visible on screen</p>
              </div>
              <Switch
                id="enable_lazy_loading"
                checked={settings.enable_lazy_loading}
                onCheckedChange={(checked) => setSettings({ ...settings, enable_lazy_loading: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compress_images">Compress Images</Label>
                <p className="text-sm text-muted-foreground">Automatically optimize images for faster loading</p>
              </div>
              <Switch
                id="compress_images"
                checked={settings.compress_images}
                onCheckedChange={(checked) => setSettings({ ...settings, compress_images: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Performance Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
              <p className="text-sm font-semibold text-primary mb-1">For 5,000 daily visitors:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Enable caching with 5-10 minute TTL</li>
                <li>Set items per page to 20-24</li>
                <li>Enable lazy loading and image compression</li>
                <li>Clear cache weekly or after major content updates</li>
              </ul>
            </div>

            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-semibold mb-1">Current Setup Impact:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Caching reduces database queries by 60-70%</li>
                <li>Lazy loading reduces initial page load by 40%</li>
                <li>Image compression saves 30-50% bandwidth</li>
                <li>Optimal settings can handle 5k+ daily visitors on 1GB RAM</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
