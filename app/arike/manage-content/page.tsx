"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Edit, Trash2, Film, Tv, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"
import { getImageUrl } from "@/lib/image-url"

interface Content {
  id: number
  title: string
  description: string
  poster_url: string
  type: string
  rating: number
  release_date: string
  quality: string
  views: number
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ManageContentPage() {
  const [content, setContent] = useState<Content[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [editingItem, setEditingItem] = useState<Content | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [deletingItem, setDeletingItem] = useState<Content | null>(null)
  const [message, setMessage] = useState("")
  const router = useRouter()

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
        loadContent()
      } catch (error) {
        console.error("[admin] Auth check failed:", error)
        router.push("/arike")
      }
    }
    checkAuth()
  }, [router, pagination.page, typeFilter])

  async function loadContent() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        type: typeFilter,
      })

      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`/api/admin/content?${params}`)
      if (response.ok) {
        const result = await response.json()
        setContent(result.data)
        setPagination(result.pagination)
      }
    } catch (error) {
      console.error("[v0] Error loading content:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPagination({ ...pagination, page: 1 })
    loadContent()
  }

  function openEditDialog(item: Content) {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditDescription(item.description || "")
    setMessage("")
  }

  async function handleUpdate() {
    if (!editingItem) return

    try {
      const headers = await getAuthHeaders()
      console.log("[admin/content] Updating content:", {
        id: editingItem.id,
        title: editTitle,
        description: editDescription
      })
      
      const response = await fetch(`/api/admin/content/${editingItem.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
        }),
      })

      console.log("[admin/content] Response status:", response.status, response.statusText)

      const data = await response.json()
      console.log("[admin/content] Response data:", data)

      if (response.ok) {
        setMessage("Content updated successfully!")
        setEditingItem(null)
        loadContent()
      } else {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || "Failed to update content"
        console.error("[admin/content] Update error:", errorMsg)
        setMessage(`Error: ${errorMsg}`)
      }
    } catch (error: any) {
      console.error("[admin/content] Update exception:", error)
      setMessage(`Failed to update content: ${error?.message || "Network error"}`)
    }
  }

  async function handleDelete() {
    if (!deletingItem) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/content/${deletingItem.id}`, {
        method: "DELETE",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        setMessage(data.message)
        setDeletingItem(null)
        loadContent()
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to delete content")
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.push("/arike/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Manage Content</h1>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${message.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
          >
            {message}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find movies and series to edit or delete</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by title or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Content</SelectItem>
                  <SelectItem value="movie">Movies Only</SelectItem>
                  <SelectItem value="series">Series Only</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            <div className="grid gap-4 mb-6">
              {content.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="relative w-24 h-36 flex-shrink-0">
                        <Image
                          src={getImageUrl(item.poster_url) || "/placeholder.svg?height=144&width=96"}
                          alt={item.title}
                          fill
                          className="object-cover rounded"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {item.type === "movie" ? (
                                <Film className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Tv className="h-4 w-4 text-muted-foreground" />
                              )}
                              <h3 className="font-semibold text-lg truncate">{item.title}</h3>
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                {item.quality}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {item.description || "No description available"}
                            </p>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Released: {item.release_date || "N/A"}</span>
                              <span>Rating: {item.rating || "N/A"}</span>
                              <span>Views: {item.views.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(item)} className="gap-2">
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingItem(item)}
                              className="gap-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {content.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No content found. Try adjusting your search or filters.
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>Update the title and description for this content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingItem?.title}" and all related data (seasons, episodes, comments).
              This action cannot be undone.
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
