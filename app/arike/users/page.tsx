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
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Trash2, ShieldAlert, ChevronLeft, ChevronRight, Key, ShieldCheck } from "lucide-react"
import Image from "next/image"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

interface User {
  id: string
  username: string
  email: string
  profile_picture_url: string | null
  role: string
  is_banned: boolean
  banned_at: string | null
  banned_reason: string | null
  last_login: string | null
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [banningUser, setBanningUser] = useState<User | null>(null)
  const [banReason, setBanReason] = useState("")
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [resettingPassword, setResettingPassword] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")
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
        loadUsers()
      } catch (error) {
        console.error("[admin] Auth check failed:", error)
        router.push("/arike")
      }
    }
    checkAuth()
  }, [router, pagination.page, statusFilter])

  async function loadUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter,
      })

      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: "include",
      })
      if (response.ok) {
        const result = await response.json()
        setUsers(result.data)
        setPagination(result.pagination)
      }
    } catch (error) {
      console.error("[v0] Error loading users:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPagination({ ...pagination, page: 1 })
    loadUsers()
  }

  function openBanDialog(user: User) {
    setBanningUser(user)
    setBanReason("")
    setMessage("")
  }

  async function handleBanToggle() {
    if (!banningUser) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/users/${encodeURIComponent(banningUser.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({
          is_banned: !banningUser.is_banned,
          banned_reason: banReason,
        }),
      })

      if (response.ok) {
        setMessage(`User ${banningUser.is_banned ? "unbanned" : "banned"} successfully!`)
        setBanningUser(null)
        setBanReason("")
        loadUsers()
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to update user status")
    }
  }

  async function handleDelete() {
    if (!deletingUser) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/users/${encodeURIComponent(deletingUser.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        setMessage(data.message)
        setDeletingUser(null)
        loadUsers()
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to delete user")
    }
  }

  function openResetPasswordDialog(user: User) {
    setResettingPassword(user)
    setNewPassword("")
    setMessage("")
  }

  async function handleResetPassword() {
    if (!resettingPassword) return

    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters")
      return
    }

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/users/${encodeURIComponent(resettingPassword.id)}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ newPassword }),
      })

      if (response.ok) {
        setMessage("Password reset successfully!")
        setResettingPassword(null)
        setNewPassword("")
      } else {
        const data = await response.json()
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage("Failed to reset password")
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
          <h1 className="text-3xl font-bold">Manage Users</h1>
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
            <CardDescription>Find users to manage their accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by username or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="banned">Banned Only</SelectItem>
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
              {users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="relative w-16 h-16 flex-shrink-0">
                        {user.profile_picture_url ? (
                          <Image
                            src={user.profile_picture_url || "/placeholder.svg"}
                            alt={user.username}
                            fill
                            className="object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{user.username}</h3>
                              <Badge variant={user.is_banned ? "destructive" : "secondary"}>
                                {user.is_banned ? "Banned" : "Active"}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {user.role}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                            {user.is_banned && user.banned_reason && (
                              <p className="text-sm text-destructive mb-2">Reason: {user.banned_reason}</p>
                            )}
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                              {user.last_login && (
                                <span>Last Login: {new Date(user.last_login).toLocaleDateString()}</span>
                              )}
                              {user.banned_at && <span>Banned: {new Date(user.banned_at).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openBanDialog(user)}
                              className={`gap-2 ${user.is_banned ? "text-green-600 hover:text-green-600" : "text-orange-600 hover:text-orange-600"}`}
                            >
                              {user.is_banned ? (
                                <>
                                  <ShieldCheck className="h-4 w-4" />
                                  Unban
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="h-4 w-4" />
                                  Ban
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResetPasswordDialog(user)}
                              className="gap-2"
                            >
                              <Key className="h-4 w-4" />
                              Reset Password
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingUser(user)}
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

            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No users found. Try adjusting your search or filters.
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

      {/* Ban/Unban Dialog */}
      <Dialog open={!!banningUser} onOpenChange={(open) => !open && setBanningUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{banningUser?.is_banned ? "Unban User" : "Ban User"}</DialogTitle>
            <DialogDescription>
              {banningUser?.is_banned
                ? `Remove the ban from ${banningUser?.username}'s account`
                : `Restrict ${banningUser?.username}'s access to the platform`}
            </DialogDescription>
          </DialogHeader>
          {!banningUser?.is_banned && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ban-reason">Reason for Ban</Label>
                <Textarea
                  id="ban-reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Enter the reason for banning this user..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanningUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleBanToggle} variant={banningUser?.is_banned ? "default" : "destructive"}>
              {banningUser?.is_banned ? "Unban User" : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resettingPassword} onOpenChange={(open) => !open && setResettingPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {resettingPassword?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResettingPassword(null)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingUser?.username}'s account and all associated data (comments,
              watchlist, reactions). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
