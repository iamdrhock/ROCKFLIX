"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, RefreshCw, Loader2 } from "lucide-react"
import Link from "next/link"
import { getAuthHeaders } from "@/lib/utils/csrf"
import { ClientHeader } from "@/components/client-header"
import { Footer } from "@/components/footer"

interface Ad {
  id?: number
  position: string
  content: string
  is_active: boolean
}

const AD_POSITIONS = [
  { value: "header", label: "Header", description: "Appears on all pages below navigation" },
  { value: "detail", label: "Detail Pages", description: "Shown on movie and series detail pages" },
  { value: "watch", label: "Watch Pages", description: "Displayed on video watch pages" },
]

export default function AdvertPage() {
  const router = useRouter()
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadAds = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch("/api/admin/advert", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - Please log in")
        }
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to load: ${response.status}`)
      }

      const data = await response.json()
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid response format")
      }

      const adsMap = new Map<string, Ad>()
      for (const ad of data) {
        if (ad && ad.position) {
          adsMap.set(ad.position, {
            id: ad.id,
            position: ad.position,
            content: ad.content || "",
            is_active: ad.is_active || false,
          })
        }
      }

      const allAds = AD_POSITIONS.map(pos => 
        adsMap.get(pos.value) || {
          position: pos.value,
          content: "",
          is_active: false,
        }
      )

      setAds(allAds)
    } catch (err: any) {
      console.error("[advert] Load error:", err)
      setError(err.message || "Failed to load ads")
      setAds(AD_POSITIONS.map(pos => ({
        position: pos.value,
        content: "",
        is_active: false,
      })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAds()
  }, [loadAds])

  const handleSaveAll = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/advert", {
        method: "PUT",
        credentials: "include",
        headers,
        body: JSON.stringify(ads),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Save failed: ${response.status}`)
      }

      setSuccess(true)
      await loadAds()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error("[advert] Save error:", err)
      setError(err.message || "Failed to save ads")
    } finally {
      setSaving(false)
    }
  }, [ads, loadAds])

  const updateAd = useCallback((position: string, field: "content" | "is_active", value: string | boolean) => {
    setAds(prev => prev.map(ad => 
      ad.position === position ? { ...ad, [field]: value } : ad
    ))
  }, [])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/arike/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Advert Management</h1>
            <p className="text-muted-foreground">Configure ad placements across your site</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadAds}
              disabled={loading || saving}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button 
              onClick={handleSaveAll} 
              disabled={saving || loading}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="mb-6 border-green-500">
            <CardContent className="pt-6">
              <p className="text-green-600 dark:text-green-400">Changes saved successfully!</p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">Loading ads...</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            {AD_POSITIONS.map(pos => {
              const ad = ads.find(a => a.position === pos.value) || {
                position: pos.value,
                content: "",
                is_active: false,
              }

              return (
                <Card key={pos.value}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{pos.label}</CardTitle>
                        <CardDescription className="mt-1">{pos.description}</CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Switch
                          checked={Boolean(ad.is_active)}
                          onCheckedChange={(checked) => {
                            updateAd(pos.value, "is_active", checked)
                          }}
                          disabled={loading || saving}
                        />
                        <span className={`text-xs ${ad.is_active ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                          {ad.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs font-mono px-2 py-1 bg-muted rounded text-muted-foreground">
                        {pos.value}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor={`content-${pos.value}`}>Ad Code</Label>
                      <Textarea
                        id={`content-${pos.value}`}
                        value={String(ad.content || "")}
                        onChange={(e) => {
                          updateAd(pos.value, "content", e.target.value)
                        }}
                        placeholder="Paste HTML or JavaScript ad code here..."
                        className="min-h-[200px] font-mono text-xs"
                        rows={8}
                        disabled={loading || saving}
                      />
                      {ad.content && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{String(ad.content).length} characters</span>
                          <span>{String(ad.content).split('\n').length} lines</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>Toggle the switch to activate/deactivate ads without deleting code</li>
              <li>Supports HTML and JavaScript ad codes (Google AdSense, etc.)</li>
              <li>Ads are responsive and adapt to screen sizes automatically</li>
              <li>Click "Save Changes" to apply your settings</li>
              <li>Changes take effect immediately after saving</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

