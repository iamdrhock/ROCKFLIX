"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CheckCircle2, XCircle, Flag, Trash2, VolumeX, AlertTriangle } from "lucide-react"

interface Comment {
  id: string
  comment_text: string
  created_at: string
  is_flagged: boolean
  flagged_reason: string | null
  is_spam: boolean
  spam_score: number
  moderation_status: string
  movie_id: number
  profiles: {
    username: string
    email: string
    profile_picture_url: string | null
    reputation_score: number
  }
}

export default function ModerationPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | "flag" | null>(null)
  const [reason, setReason] = useState("")
  const [selectedTab, setSelectedTab] = useState("all")
  const [muteDialog, setMuteDialog] = useState<{ userId: string; username: string } | null>(null)
  const [muteDuration, setMuteDuration] = useState("24")
  const [muteReason, setMuteReason] = useState("")
  const router = useRouter()

  useEffect(() => {
    const auth = localStorage.getItem("admin_auth")
    if (!auth) {
      router.push("/arike")
      return
    }
    loadComments(selectedTab)
  }, [router, selectedTab])

  async function loadComments(status: string) {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/moderation/comments?status=${status}`)
      if (response.ok) {
        const result = await response.json()
        setComments(result.data)
      }
    } catch (error) {
      console.error("[v0] Error loading comments:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleModerate() {
    if (!selectedComment || !action) return

    try {
      const response = await fetch(`/api/admin/moderation/comments/${selectedComment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
          moderator_id: "admin", // In production, use actual moderator ID
        }),
      })

      if (response.ok) {
        setSelectedComment(null)
        setAction(null)
        setReason("")
        loadComments(selectedTab)
      }
    } catch (error) {
      console.error("[v0] Error moderating comment:", error)
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Are you sure you want to delete this comment?")) return

    try {
      const response = await fetch(`/api/admin/moderation/comments/${commentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        loadComments(selectedTab)
      }
    } catch (error) {
      console.error("[v0] Error deleting comment:", error)
    }
  }

  async function handleMute() {
    if (!muteDialog) return

    try {
      const response = await fetch(`/api/admin/moderation/users/${muteDialog.userId}/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_hours: Number.parseInt(muteDuration),
          reason: muteReason,
          moderator_id: "admin",
        }),
      })

      if (response.ok) {
        setMuteDialog(null)
        setMuteDuration("24")
        setMuteReason("")
        alert("User muted successfully")
      }
    } catch (error) {
      console.error("[v0] Error muting user:", error)
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "approved":
        return "default"
      case "pending":
        return "secondary"
      case "rejected":
        return "destructive"
      default:
        return "outline"
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
          <h1 className="text-3xl font-bold">Content Moderation</h1>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Comments</TabsTrigger>
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
            <TabsTrigger value="flagged">Flagged</TabsTrigger>
            <TabsTrigger value="spam">Spam Detected</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            {loading ? (
              <div className="text-center py-12">Loading...</div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                            {comment.profiles.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-base">{comment.profiles.username}</CardTitle>
                            <CardDescription>{comment.profiles.email}</CardDescription>
                            <div className="flex gap-2 mt-1">
                              <Badge variant={getStatusColor(comment.moderation_status)}>
                                {comment.moderation_status}
                              </Badge>
                              {comment.is_flagged && (
                                <Badge variant="destructive" className="gap-1">
                                  <Flag className="h-3 w-3" />
                                  Flagged
                                </Badge>
                              )}
                              {comment.is_spam && (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Spam ({comment.spam_score})
                                </Badge>
                              )}
                              <Badge variant="outline">Rep: {comment.profiles.reputation_score}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {comment.moderation_status !== "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedComment(comment)
                                setAction("approve")
                              }}
                              className="gap-2 text-green-600 hover:text-green-600"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                          )}
                          {comment.moderation_status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedComment(comment)
                                setAction("reject")
                              }}
                              className="gap-2 text-orange-600 hover:text-orange-600"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          )}
                          {!comment.is_flagged && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedComment(comment)
                                setAction("flag")
                              }}
                              className="gap-2"
                            >
                              <Flag className="h-4 w-4" />
                              Flag
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setMuteDialog({
                                userId: comment.profiles.username,
                                username: comment.profiles.username,
                              })
                            }
                            className="gap-2"
                          >
                            <VolumeX className="h-4 w-4" />
                            Mute User
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(comment.id)}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{comment.comment_text}</p>
                      {comment.flagged_reason && (
                        <p className="text-sm text-destructive mt-2">Flag reason: {comment.flagged_reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Posted: {new Date(comment.created_at).toLocaleString()} | Movie ID: {comment.movie_id}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                {comments.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No comments found in this category.</div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Moderation Action Dialog */}
      <Dialog open={!!selectedComment} onOpenChange={(open) => !open && setSelectedComment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "Approve Comment"}
              {action === "reject" && "Reject Comment"}
              {action === "flag" && "Flag Comment"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve" && "This comment will be made visible to all users."}
              {action === "reject" && "This comment will be hidden from public view."}
              {action === "flag" && "Mark this comment for manual review."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for this action..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedComment(null)}>
              Cancel
            </Button>
            <Button onClick={handleModerate}>{action === "approve" ? "Approve" : action}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mute User Dialog */}
      <Dialog open={!!muteDialog} onOpenChange={(open) => !open && setMuteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mute User</DialogTitle>
            <DialogDescription>Temporarily prevent {muteDialog?.username} from posting comments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={muteDuration} onValueChange={setMuteDuration}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mute-reason">Reason</Label>
              <Textarea
                id="mute-reason"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder="Enter reason for muting this user..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleMute}>Mute User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
