"use client"

import type React from "react"

import { useState, useEffect } from "react"
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

export default function CreatePagePage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [content, setContent] = useState("")
  const [featuredImage, setFeaturedImage] = useState<File | null>(null)
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchCsrfToken().catch(console.error)
  }, [])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    // Auto-generate slug from title if slug is empty
    if (!slug) {
      const generatedSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      setSlug(generatedSlug)
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

    try {
      setCreating(true)

      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/pages", {
        method: "POST",
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
        let errorMessage = "Failed to create page"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Failed to create page (${response.status})`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Verify that we got a page back
      if (!data || !data.page) {
        throw new Error("Page was created but no data was returned")
      }

      // Only redirect on success
      router.push("/arike/pages")
    } catch (error: any) {
      console.error("Error creating page:", error)
      setError(error.message || "Failed to create page. Please try again.")
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/arike/pages")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Create Custom Page</h1>
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
                  onChange={(e) => handleTitleChange(e.target.value)}
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
                <p className="text-sm text-muted-foreground">
                  This will be the URL: yoursite.com/{slug || "your-slug"}
                </p>
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
                <Button type="button" variant="outline" onClick={() => router.push("/arike/pages")} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || uploading}>
                  {creating ? "Creating..." : "Create Page"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
