"use client"

import type React from "react"

import { useState, useEffect, use } from "react"
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

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [body, setBody] = useState("")
  const [featuredImageUrl, setFeaturedImageUrl] = useState("")
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    fetchCsrfToken().catch(console.error)
    if (!id) {
      setError("Missing blog post id")
      setLoading(false)
      return
    }
    fetchPost(id)
  }, [id])

  const fetchPost = async (postId: string) => {
    try {
      const response = await fetch(`/api/admin/blog/${postId}`, {
        credentials: "include",
      })

      let data: any = null
      try {
        data = await response.json()
      } catch (parseError) {
        console.error("[admin] Failed to parse blog post response", parseError)
      }

      if (response.ok && data?.post) {
        setTitle(data.post.title ?? "")
        setSlug(String(data.post.slug ?? ""))
        setBody(String(data.post.body ?? ""))
        setFeaturedImageUrl(data.post.featured_image_url || "")
        setPublished(Boolean(data.post.published))
        setError("")
      } else {
        console.error("Failed to fetch post:", {
          status: response.status,
          statusText: response.statusText,
          data,
          url: response.url,
        })
        setError(data?.error || "Failed to load post")
      }
    } catch (error) {
      console.error("Error fetching post:", error)
      setError("Failed to load post")
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)

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
    setSuccess("")

    if (!title || !slug || !body) {
      setError("Title, slug, and body are required")
      return
    }

    if (!id) {
      setError("Missing blog post id")
      return
    }

    try {
      setSaving(true)
      
      const payload = {
        title,
        slug,
        body,
        featured_image_url: featuredImageUrl || null,
        published,
      }
      
      console.log("[admin/blog/edit] 🚀 Starting update request:", {
        id,
        url: `/api/admin/blog/${id}`,
        payload: {
          ...payload,
          bodyLength: body.length
        }
      })

      const headers = await getAuthHeaders()
      console.log("[admin/blog/edit] 📤 Sending PATCH request with headers:", Object.keys(headers))
      
      const response = await fetch(`/api/admin/blog/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      })

      console.log("[admin/blog/edit] 📥 Response received:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url
      })

      if (!response.ok) {
        let errorMessage = "Failed to update post"
        let errorData: any = null
        try {
          errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          console.error("[admin/blog/edit] ❌ Error response:", errorData)
        } catch (parseError) {
          console.error("[admin/blog/edit] ❌ Failed to parse error response:", parseError)
          errorMessage = `Failed to update post (${response.status})`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log("[admin/blog/edit] 📦 Response data:", {
        hasData: !!data,
        hasPost: !!data?.post,
        postId: data?.post?.id,
        postTitle: data?.post?.title
      })
      
      // Verify that we got a post back with valid data
      if (!data || !data.post) {
        console.error("[admin/blog/edit] ❌ Update response missing post data:", data)
        throw new Error("Post was updated but no data was returned. Please refresh and check if your changes were saved.")
      }
      
      // Verify the post has an ID to confirm it was actually saved
      if (!data.post.id) {
        console.error("[admin/blog/edit] ❌ Update response has invalid post:", data.post)
        throw new Error("Update response is invalid. Please refresh and check if your changes were saved.")
      }
      
      console.log("[admin/blog/edit] ✅ Blog post successfully updated:", {
        id: data.post.id,
        title: data.post.title,
        slug: data.post.slug,
        savedTitle: data.post.title,
        sentTitle: title,
        titlesMatch: data.post.title === title,
        savedSlug: data.post.slug,
        sentSlug: slug,
        slugsMatch: data.post.slug === slug
      })
      
      // Verify the saved data matches what we sent
      if (data.post.title !== title || data.post.slug !== slug) {
        console.warn("[admin/blog/edit] ⚠️ Saved data doesn't match sent data:", {
          sent: { title, slug },
          saved: { title: data.post.title, slug: data.post.slug }
        })
        setError(`Warning: Saved data may differ. Saved title: "${data.post.title}", Sent: "${title}"`)
      } else {
        // Show success message and stay on page
        setSuccess(`✅ Post saved successfully! Title: "${data.post.title}" | Slug: "${data.post.slug}"`)
        console.log("[admin/blog/edit] ✅ Success - Data matches. Post saved correctly!")
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess("")
        }, 5000)
      }
    } catch (error: any) {
      console.error("[admin/blog/edit] ❌ Error updating blog post:", error)
      setError(error.message || "Failed to update post. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto text-center py-12">Loading post...</div>
      </div>
    )
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
            <h1 className="text-3xl font-bold">Edit Blog Post</h1>
            <p className="text-muted-foreground">Update your blog post content</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Post Details</CardTitle>
              <CardDescription>Update the details for your blog post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm font-medium">{success}</div>}

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  <Label htmlFor="published">Published</Label>
                  <p className="text-xs text-muted-foreground">Make this post visible to the public</p>
                </div>
                <Switch id="published" checked={published} onCheckedChange={setPublished} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" variant="outline" onClick={() => router.push("/arike/blog")}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploadingImage}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
