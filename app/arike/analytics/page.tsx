"use client"

import { ClientHeader } from "@/components/client-header"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, Search, AlertCircle, Users, TrendingUp, Monitor, Smartphone, Tablet } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { fetchCsrfToken } from "@/lib/utils/csrf"

interface AnalyticsData {
  overview: {
    totalViews: number
    uniqueVisitors: number
    totalSearches: number
    totalErrors: number
  }
  mostWatched: Array<{
    movie: {
      id: number
      title: string
      poster_url: string
      type: string
    }
    count: number
  }>
  popularSearches: Array<{
    query: string
    count: number
  }>
  deviceBreakdown: Record<string, number>
  recentErrors: Array<{
    error_type: string
    player_used: string
    movies: { title: string }
  }>
  trendData: Array<{
    date: string
    views: number
  }>
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

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
        loadAnalytics()
      } catch (error) {
        console.error("[admin] Auth check failed:", error)
        router.push("/arike")
      }
    }
    checkAuth()
  }, [router])

  async function loadAnalytics() {
    try {
      // Add cache-busting timestamp to ensure fresh data
      const response = await fetch(`/api/admin/analytics/overview?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      })
      if (response.ok) {
        const data = await response.json()
        console.log("[analytics] Loaded analytics data:", data)
        setAnalytics(data)
      } else {
        console.error("[analytics] Failed to load analytics:", response.status, response.statusText)
      }
    } catch (error) {
      console.error("[v0] Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = (device: string) => {
    if (device === "mobile") return <Smartphone className="h-4 w-4" />
    if (device === "tablet") return <Tablet className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Last 30 days performance metrics</p>
          </div>
          <button
            onClick={() => {
              setLoading(true)
              loadAnalytics()
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Refresh
          </button>
          <Link href="/arike/dashboard">
            <button className="px-4 py-2 rounded-lg bg-card border border-border hover:bg-accent">
              Back to Dashboard
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.totalViews.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Content views tracked</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.uniqueVisitors.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Unique sessions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Searches</CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.totalSearches.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Search queries</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Player Errors</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overview.totalErrors.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Playback issues reported</p>
                </CardContent>
              </Card>
            </div>

            {/* Viewing Trend */}
            {analytics.trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Viewing Trend (Last 7 Days)
                  </CardTitle>
                  <CardDescription>Daily view counts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.trendData.map((day) => (
                      <div key={day.date} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{day.date}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-48 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${(day.views / Math.max(...analytics.trendData.map((d) => d.views))) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{day.views}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Watched Content */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Watched Content</CardTitle>
                  <CardDescription>Top 10 movies and series by views</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.mostWatched.length > 0 ? (
                      analytics.mostWatched.map((item, index) => (
                        <div key={item.movie.id} className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                          <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={item.movie.poster_url || "/placeholder.svg"}
                              alt={item.movie.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.movie.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.movie.type}</p>
                          </div>
                          <span className="text-sm font-semibold">{item.count} views</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No viewing data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Popular Searches */}
              <Card>
                <CardHeader>
                  <CardTitle>Popular Search Terms</CardTitle>
                  <CardDescription>Top 10 searched queries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.popularSearches.length > 0 ? (
                      analytics.popularSearches.map((search, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                            <span className="text-sm truncate">{search.query}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{search.count}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No search data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Device Breakdown & Recent Errors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Device Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Device Breakdown</CardTitle>
                  <CardDescription>Views by device type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.deviceBreakdown).map(([device, count]) => (
                      <div key={device} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(device)}
                          <span className="text-sm capitalize">{device}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${(count / Object.values(analytics.deviceBreakdown).reduce((a, b) => a + b, 0)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Player Errors */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Player Errors</CardTitle>
                  <CardDescription>Latest playback issues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.recentErrors.length > 0 ? (
                      analytics.recentErrors.slice(0, 10).map((error, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{error.movies?.title || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
                              {error.error_type} - {error.player_used}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No errors reported</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Failed to load analytics data</p>
          </div>
        )}
      </main>
    </div>
  )
}
