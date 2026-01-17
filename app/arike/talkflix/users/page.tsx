"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Search, Ban, Volume2, VolumeX, Users } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

interface User {
  id: string
  username: string
  email: string
  profile_picture_url?: string
  is_banned: boolean
  is_muted: boolean
  muted_until?: string
  banned_reason?: string
  muted_reason?: string
  created_at: string
  reputation_score: number
  role: string
}

export default function TalkFlixUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [banDialog, setBanDialog] = useState(false)
  const [muteDialog, setMuteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [reason, setReason] = useState("")
  const [muteDuration, setMuteDuration] = useState("1")

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
  }, [router])

  async function loadUsers() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)

      const response = await fetch(`/api/admin/talkflix/users?${params}`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleBanUser() {
    if (!selectedUser) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/talkflix/users/${selectedUser.id}/ban`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          is_banned: !selectedUser.is_banned,
          banned_reason: selectedUser.is_banned ? null : reason,
        }),
      })

      if (response.ok) {
        loadUsers()
        setBanDialog(false)
        setSelectedUser(null)
        setReason("")
      }
    } catch (error) {
      console.error("Error banning/unbanning user:", error)
    }
  }

  async function handleMuteUser() {
    if (!selectedUser) return

    try {
      const hours = Number.parseInt(muteDuration)
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/talkflix/users/${selectedUser.id}/mute`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          is_muted: !selectedUser.is_muted,
          muted_reason: selectedUser.is_muted ? null : reason,
          hours: selectedUser.is_muted ? 0 : hours,
        }),
      })

      if (response.ok) {
        loadUsers()
        setMuteDialog(false)
        setSelectedUser(null)
        setReason("")
        setMuteDuration("1")
      }
    } catch (error) {
      console.error("Error muting/unmuting user:", error)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadUsers()
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
          <h1 className="text-3xl font-bold">Manage TalkFlix Users</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <CardDescription>Search users by username or email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit">Search</Button>
              {searchQuery && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("")
                    setTimeout(loadUsers, 0)
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Users ({users.length})</CardTitle>
            <CardDescription>View and manage all TalkFlix users</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reputation</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.profile_picture_url ? (
                            <img
                              src={user.profile_picture_url || "/placeholder.svg"}
                              alt={user.username}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.is_banned && <Badge variant="destructive">Banned</Badge>}
                          {user.is_muted && <Badge variant="secondary">Muted</Badge>}
                          {!user.is_banned && !user.is_muted && <Badge variant="outline">Active</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.reputation_score}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant={user.is_banned ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setBanDialog(true)
                            }}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={user.is_muted ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setMuteDialog(true)
                            }}
                          >
                            {user.is_muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
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
      </main>

      <Dialog open={banDialog} onOpenChange={setBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.is_banned ? "Unban User" : "Ban User"}</DialogTitle>
            <DialogDescription>
              {selectedUser?.is_banned
                ? `Remove the ban from ${selectedUser.username}?`
                : `Ban ${selectedUser?.username} from TalkFlix?`}
            </DialogDescription>
          </DialogHeader>
          {!selectedUser?.is_banned && (
            <div className="space-y-2">
              <Label htmlFor="ban-reason">Reason</Label>
              <Textarea
                id="ban-reason"
                placeholder="Enter reason for ban..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBanDialog(false)}>
              Cancel
            </Button>
            <Button variant={selectedUser?.is_banned ? "default" : "destructive"} onClick={handleBanUser}>
              {selectedUser?.is_banned ? "Unban" : "Ban User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={muteDialog} onOpenChange={setMuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.is_muted ? "Unmute User" : "Mute User"}</DialogTitle>
            <DialogDescription>
              {selectedUser?.is_muted
                ? `Remove the mute from ${selectedUser.username}?`
                : `Temporarily mute ${selectedUser?.username} from posting?`}
            </DialogDescription>
          </DialogHeader>
          {!selectedUser?.is_muted && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mute-duration">Duration (hours)</Label>
                <Input
                  id="mute-duration"
                  type="number"
                  min="1"
                  max="720"
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mute-reason">Reason</Label>
                <Textarea
                  id="mute-reason"
                  placeholder="Enter reason for mute..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMuteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMuteUser}>{selectedUser?.is_muted ? "Unmute" : "Mute User"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
