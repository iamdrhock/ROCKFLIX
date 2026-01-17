"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Repeat } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface RepostDialogProps {
  postId: number
  open: boolean
  onClose: () => void
  onRepost: () => void
}

export function RepostDialog({ postId, open, onClose, onRepost }: RepostDialogProps) {
  const [quoteContent, setQuoteContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [repostType, setRepostType] = useState<"simple" | "quote">("simple")
  const { toast } = useToast()

  const handleRepost = async () => {
    console.log("[v0] Repost button clicked, type:", repostType, "postId:", postId)
    setIsSubmitting(true)

    try {
      console.log("[v0] Making fetch request to repost API")
      const response = await fetch(`/api/community/posts/${postId}/repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_content: repostType === "quote" ? quoteContent : null,
        }),
      })

      console.log("[v0] Response status:", response.status)
      const data = await response.json()
      console.log("[v0] Response data:", data)

      if (response.ok) {
        toast({
          title: data.message || "Success!",
          description: repostType === "quote" ? "Your quote has been posted" : "Post reposted successfully",
        })

        onRepost()
        onClose()
        setQuoteContent("")
        setRepostType("simple")
      } else {
        console.error("[v0] Repost failed:", data.error)
        toast({
          title: "Error",
          description: data.error || "Failed to repost. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error reposting:", error)
      toast({
        title: "Error",
        description: "Failed to repost. Please check your connection.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repost</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={repostType === "simple" ? "default" : "outline"}
              onClick={() => setRepostType("simple")}
              className="flex-1"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Repost
            </Button>
            <Button
              variant={repostType === "quote" ? "default" : "outline"}
              onClick={() => setRepostType("quote")}
              className="flex-1"
            >
              Quote
            </Button>
          </div>

          {repostType === "quote" && (
            <Textarea
              placeholder="Add your thoughts..."
              value={quoteContent}
              onChange={(e) => setQuoteContent(e.target.value)}
              maxLength={500}
              rows={4}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleRepost} disabled={isSubmitting}>
              {isSubmitting ? "Reposting..." : "Repost"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
