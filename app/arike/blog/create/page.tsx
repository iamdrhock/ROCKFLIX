"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

export default function CreateBlogPostPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [body, setBody] = useState("")
  const [featuredImage, setFeaturedImage] = useState<File | null>(null)
  const [featuredImageUrl, setFeaturedImageUrl] = useState("")
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    fetchCsrfToken().catch(console.error)
  }, [])

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(value))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      setFeaturedImage(file)

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

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      const data = await response.json()
      setFeaturedImageUrl(data.url)
    } catch (error) {
      console.error("Error uploading image:", error)
      setError("Failed to upload image")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!title || !slug || !body) {
      setError("Title, slug, and body are required")
      return
    }

    try {
      setLoading(true)

      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/blog", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          slug,
          body,
          featured_image_url: featuredImageUrl || null,
          published,
        }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to create post"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Failed to create post (${response.status})`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Verify that we got a post back
      if (!data || !data.post) {
        throw new Error("Post was created but no data was returned")
      }

      // Only redirect on success
      router.push("/arike/blog")
    } catch (error: any) {
      console.error("Error creating blog post:", error)
      setError(error.message || "Failed to create post. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/arike/blog">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Blog Post</h1>
            <p className="text-muted-foreground">Write a new blog post for your site</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Post Details</CardTitle>
              <CardDescription>Fill in the details for your new blog post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter post title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="post-url-slug"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly version of the title. Will be used in the post URL.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your post content here..."
                  rows={12}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Featured Image</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                  {uploadingImage && <span className="text-sm text-muted-foreground">Uploading...</span>}
                </div>
                {featuredImageUrl && (
                  <div className="mt-2">
                    <img src={featuredImageUrl || "/placeholder.svg"} alt="Preview" className="max-w-xs rounded-lg" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="published">Publish immediately</Label>
                  <p className="text-xs text-muted-foreground">Make this post visible to the public right away</p>
                </div>
                <Switch id="published" checked={published} onCheckedChange={setPublished} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" variant="outline" onClick={() => router.push("/arike/blog")}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingImage}>
              {loading ? "Creating..." : "Create Post"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
