"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminSession } from "@/hooks/use-admin-session"
import { getAuthHeaders } from "@/lib/utils/csrf"
import { ClientHeader } from "@/components/client-header"
import { Send, Bell, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function PushNotificationsPage() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [platform, setPlatform] = useState<string>("all")
  const [limit, setLimit] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { loading: authLoading } = useAdminSession()

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required")
      return
    }

    setLoading(true)

    try {
      const headers = await getAuthHeaders()

      const response = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl.trim() || undefined,
          platform: platform === "all" ? undefined : platform,
          limit: limit ? parseInt(limit, 10) : undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const { results } = data
        toast.success(
          `Push notification sent! ${results.successCount} delivered, ${results.failureCount} failed (out of ${results.totalTokens} devices)`
        )
        // Reset form
        setTitle("")
        setBody("")
        setImageUrl("")
        setLimit("")
      } else {
        toast.error(data.error || "Failed to send push notification")
      }
    } catch (error: any) {
      console.error("[Push] Error sending notification:", error)
      toast.error(error.message || "Failed to send push notification")
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" data-admin-panel>
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Push Notifications</h1>
              <p className="text-muted-foreground mt-1">
                Send push notifications to all users with the app installed
              </p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Send Push Notification
              </CardTitle>
              <CardDescription>
                Broadcast a message to all users who have push notifications enabled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="New Episode Available!"
                    required
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    {title.length}/100 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Message *</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Check out the latest episode of your favorite show..."
                    required
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {body.length}/500 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL (Optional)</Label>
                  <Input
                    id="image_url"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Large image to display in the notification (optional)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger id="platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platforms</SelectItem>
                        <SelectItem value="android">Android Only</SelectItem>
                        <SelectItem value="ios">iOS Only</SelectItem>
                        <SelectItem value="web">Web Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="limit">Limit (Optional)</Label>
                    <Input
                      id="limit"
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="1000"
                      min={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Max number of devices to send to (for testing)
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !title.trim() || !body.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Push Notification
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Keep titles short and attention-grabbing (under 50 characters)</li>
                <li>Use clear, actionable messages</li>
                <li>Test with a limit first before sending to all users</li>
                <li>Include images to increase engagement</li>
                <li>Send during peak usage hours for best results</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

