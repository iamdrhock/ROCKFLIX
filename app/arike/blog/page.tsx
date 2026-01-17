"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Plus, Search, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface BlogPost {
  id: number
  title: string
  slug: string
  body: string
  featured_image_url: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export default function BlogManagementPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCsrfToken().catch(console.error)
    fetchPosts()
  }, [search])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append("search", search)

      const response = await fetch(`/api/admin/blog?${params.toString()}`, {
        credentials: "include",
      })
      let data: any = null
      try {
        data = await response.json()
      } catch (parseError) {
        console.error("[admin] Failed to parse blog list response", parseError)
      }

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch blog posts")
      }

      setPosts(Array.isArray(data?.posts) ? data.posts : [])
    } catch (error) {
      console.error("Error fetching posts:", error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!postToDelete) return

    try {
      setDeleting(true)
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/blog/${postToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
        headers,
      })

      if (response.ok) {
        setPosts(posts.filter((p) => p.id !== postToDelete.id))
        setDeleteDialogOpen(false)
        setPostToDelete(null)
      }
    } catch (error) {
      console.error("Error deleting post:", error)
    } finally {
      setDeleting(false)
    }
  }

  const togglePublished = async (post: BlogPost) => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/blog/${post.id}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({ published: !post.published }),
      })

      if (response.ok) {
        setPosts(posts.map((p) => (p.id === post.id ? { ...p, published: !p.published } : p)))
      }
    } catch (error) {
      console.error("Error updating post:", error)
    }
  }

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
            <h1 className="text-3xl font-bold">Blog Management</h1>
            <p className="text-muted-foreground">Create and manage blog posts</p>
          </div>
          <Button asChild>
            <Link href="/arike/blog/create">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Blog Posts</CardTitle>
            <CardDescription>Manage your blog posts, edit content, and control visibility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No blog posts found. Create your first post!</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                          {post.featured_image_url ? (
                            <Image
                              src={post.featured_image_url || "/placeholder.svg"}
                              alt={post.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              No image
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{post.title}</TableCell>
                      <TableCell className="text-muted-foreground">{post.slug}</TableCell>
                      <TableCell>
                        <Badge
                          variant={post.published ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => togglePublished(post)}
                        >
                          {post.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/arike/blog/edit/${post.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPostToDelete(post)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Blog Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{postToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
