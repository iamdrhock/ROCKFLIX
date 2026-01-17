"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Pencil, Trash2, ArrowLeft, ExternalLink } from "lucide-react"

interface CustomPage {
  id: number
  title: string
  slug: string
  content: string
  featured_image_url: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export default function ManagePagesPage() {
  const router = useRouter()
  const [pages, setPages] = useState<CustomPage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchPages()
  }, [searchQuery])

  const fetchPages = async () => {
    try {
      const url = `/api/admin/pages${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`
      const response = await fetch(url)
      const data = await response.json()
      setPages(data.pages || [])
    } catch (error) {
      console.error("Error fetching pages:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/pages/${deleteId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setPages(pages.filter((page) => page.id !== deleteId))
        setDeleteId(null)
      } else {
        alert("Failed to delete page")
      }
    } catch (error) {
      console.error("Error deleting page:", error)
      alert("Failed to delete page")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/arike/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Manage Custom Pages</h1>
          </div>
          <Button onClick={() => router.push("/arike/pages/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Page
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Custom Pages</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search pages by title or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading pages...</div>
            ) : pages.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No pages found. Create your first custom page!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.title}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">/{page.slug}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={page.published ? "default" : "secondary"}>
                          {page.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {page.featured_image_url ? (
                          <span className="text-sm text-green-600">✓ Yes</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No image</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(page.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/${page.slug}`, "_blank")}
                            title="View page"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/arike/pages/edit/${page.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(page.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
