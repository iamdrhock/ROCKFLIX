"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle, Send, ThumbsUp, ThumbsDown } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface Comment {
  id: number
  post_id: number
  user_id: string
  content: string
  parent_comment_id?: number
  replies_count: number
  likes_count: number
  dislikes_count: number
  userReaction?: "like" | "dislike" | null
  created_at: string
  profiles: {
    id: string
    username: string
    profile_picture_url?: string
  }
  replies: Comment[]
}

interface PostThreadProps {
  postId: number
  onClose: () => void
  showCloseButton?: boolean // Added optional prop to control close button visibility
}

export function PostThread({ postId, onClose, showCloseButton = true }: PostThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState("")
  const [nestedReplyContent, setNestedReplyContent] = useState<Record<number, string>>({})
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [postId])

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`)
      const data = await response.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error("Error fetching comments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReply = async (parentCommentId?: number) => {
    const content = parentCommentId ? nestedReplyContent[parentCommentId] || "" : replyContent
    if (!content.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content,
          parent_comment_id: parentCommentId,
        }),
      })

      if (response.ok) {
        if (parentCommentId) {
          setNestedReplyContent((prev) => {
            const updated = { ...prev }
            delete updated[parentCommentId]
            return updated
          })
        } else {
          setReplyContent("")
        }
        setReplyingTo(null)
        fetchComments()
      }
    } catch (error) {
      console.error("Error submitting reply:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCommentReaction = async (commentId: number, isLike: boolean) => {
    try {
      const response = await fetch(`/api/community/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLike }),
      })

      if (response.ok) {
        // Refresh comments to get updated counts
        fetchComments()
      }
    } catch (error) {
      console.error("Error reacting to comment:", error)
    }
  }

  const CommentItem = ({ comment, isNested = false }: { comment: Comment; isNested?: boolean }) => (
    <div className={`${isNested ? "ml-12 mt-3" : ""}`}>
      <div className="flex gap-3">
        <Link href={`/community/profile/${comment.profiles.username}`}>
          {comment.profiles.profile_picture_url ? (
            <Image
              src={comment.profiles.profile_picture_url || "/placeholder.svg"}
              alt={comment.profiles.username}
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {comment.profiles.username.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/community/profile/${comment.profiles.username}`}
              className="font-semibold text-sm hover:underline"
            >
              {comment.profiles.username}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 gap-1 text-xs", comment.userReaction === "like" && "text-primary")}
              onClick={() => handleCommentReaction(comment.id, true)}
            >
              <ThumbsUp className={cn("h-3 w-3", comment.userReaction === "like" && "fill-current")} />
              <span>{comment.likes_count || 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 gap-1 text-xs", comment.userReaction === "dislike" && "text-destructive")}
              onClick={() => handleCommentReaction(comment.id, false)}
            >
              <ThumbsDown className={cn("h-3 w-3", comment.userReaction === "dislike" && "fill-current")} />
              <span>{comment.dislikes_count || 0}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setReplyingTo(comment.id)}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              Reply
            </Button>
          </div>

          {replyingTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <Textarea
                value={nestedReplyContent[comment.id] || ""}
                onChange={(e) =>
                  setNestedReplyContent((prev) => ({
                    ...prev,
                    [comment.id]: e.target.value,
                  }))
                }
                placeholder="Write a reply..."
                className="min-h-[60px] text-sm"
              />
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={() => handleSubmitReply(comment.id)} disabled={submitting}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} isNested />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-4">
        {showCloseButton && (
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Replies</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {!showCloseButton && <h3 className="font-semibold">Replies</h3>}

        <div className="space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[80px]"
          />
          <Button onClick={() => handleSubmitReply()} disabled={submitting || !replyContent.trim()} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            Post Reply
          </Button>
        </div>

        <div className="space-y-4 pt-4 border-t">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading replies...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No replies yet. Be the first to reply!</p>
          ) : (
            comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)
          )}
        </div>
      </CardContent>
    </Card>
  )
}
