"use client"

import type React from "react"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, X } from "lucide-react"
import Image from "next/image"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

interface CustomPage {
  id: number
  title: string
  slug: string
  content: string
  featured_image_url: string | null
  published: boolean
}

export default function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [page, setPage] = useState<CustomPage | null>(null)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [content, setContent] = useState("")
  const [featuredImage, setFeaturedImage] = useState<File | null>(null)
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchCsrfToken().catch(console.error)
    fetchPage()
  }, [id])

  const fetchPage = async () => {
    try {
      const response = await fetch(`/api/admin/pages/${id}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (response.ok) {
        setPage(data.page)
        setTitle(data.page.title)
        setSlug(data.page.slug)
        setContent(data.page.content)
        setFeaturedImageUrl(data.page.featured_image_url)
        setPublished(data.page.published)
      } else {
        console.error("Failed to fetch page:", data)
        setError(data.error || "Failed to load page")
      }
    } catch (error) {
      console.error("Error fetching page:", error)
      setError("Failed to load page")
    } finally {
      setLoading(false)
    }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFeaturedImage(file)
    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const headers = await getAuthHeaders()
      // Remove Content-Type header for FormData (browser will set it with boundary)
      const { "Content-Type": _, ...formHeaders } = headers

      const response = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        credentials: "include",
        headers: formHeaders,
        body: formData,
      })

      if (!response.ok) throw new Error("Failed to upload image")

      const data = await response.json()
      setFeaturedImageUrl(data.url)
    } catch (error) {
      console.error("Error uploading image:", error)
      setError("Failed to upload image. Please try again.")
      setFeaturedImage(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setFeaturedImage(null)
    setFeaturedImageUrl(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!title || !slug || !content) {
      setError("Title, slug, and content are required")
      return
    }

    if (!id) {
      setError("Missing page id")
      return
    }

    try {
      setUpdating(true)

      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/pages/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({
          title,
          slug,
          content,
          featured_image_url: featuredImageUrl,
          published,
        }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to update page"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Failed to update page (${response.status})`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Verify that we got a page back with valid data
      if (!data || !data.page) {
        console.error("[admin] Update response missing page data:", data)
        throw new Error("Page was updated but no data was returned. Please refresh and check if your changes were saved.")
      }
      
      // Verify the page has an ID to confirm it was actually saved
      if (!data.page.id) {
        console.error("[admin] Update response has invalid page:", data.page)
        throw new Error("Update response is invalid. Please refresh and check if your changes were saved.")
      }
      
      console.log("[admin] ✅ Page successfully updated:", data.page.id, data.page.title)

      // Only redirect on success
      router.push("/arike/pages")
    } catch (error: any) {
      console.error("Error updating page:", error)
      setError(error.message || "Failed to update page. Please try again.")
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading page...</p>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Page not found</p>
          <Button onClick={() => router.push("/arike/pages")} className="mt-4">
            Back to Pages
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/arike/pages")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Edit Page</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Page Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

              <div className="space-y-2">
                <Label htmlFor="title">Page Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="About Us"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="about-us"
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">This will be the URL: yoursite.com/{slug}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Page Content *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your page content here..."
                  rows={12}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Featured Image (Optional)</Label>
                {featuredImageUrl ? (
                  <div className="relative">
                    <Image
                      src={featuredImageUrl || "/placeholder.svg"}
                      alt="Featured"
                      width={400}
                      height={225}
                      className="rounded-lg object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={uploading}
                      className="flex-1"
                    />
                    {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="published">Publish Page</Label>
                  <p className="text-sm text-muted-foreground">Make this page visible to the public</p>
                </div>
                <Switch id="published" checked={published} onCheckedChange={setPublished} />
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => router.push("/arike/pages")} disabled={updating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updating || uploading}>
                  {updating ? "Updating..." : "Update Page"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
