"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface NotificationPreferences {
  email_new_episodes: boolean
  email_comment_replies: boolean
  email_weekly_digest: boolean
  email_new_favorites: boolean
  email_marketing: boolean
  digest_frequency: string
}

export function NotificationPreferencesForm() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_new_episodes: true,
    email_comment_replies: true,
    email_weekly_digest: true,
    email_new_favorites: false,
    email_marketing: false,
    digest_frequency: "weekly",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const response = await fetch("/api/notifications/preferences")
      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
      }
    } catch (error) {
      console.error("[v0] Error fetching preferences:", error)
    } finally {
      setIsFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        throw new Error("Failed to update preferences")
      }

      toast.success("Notification preferences updated successfully!")
    } catch (error) {
      console.error("[v0] Error updating preferences:", error)
      toast.error("Failed to update preferences")
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return <div className="text-center py-4">Loading preferences...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="new-episodes">New Episode Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Get notified when new episodes of series you follow are released
            </p>
          </div>
          <Switch
            id="new-episodes"
            checked={preferences.email_new_episodes}
            onCheckedChange={(checked) => setPreferences({ ...preferences, email_new_episodes: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="comment-replies">Comment Replies</Label>
            <p className="text-sm text-muted-foreground">Get notified when someone replies to your comments</p>
          </div>
          <Switch
            id="comment-replies"
            checked={preferences.email_comment_replies}
            onCheckedChange={(checked) => setPreferences({ ...preferences, email_comment_replies: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="weekly-digest">Weekly Content Digest</Label>
            <p className="text-sm text-muted-foreground">Receive a weekly summary of new movies and series</p>
          </div>
          <Switch
            id="weekly-digest"
            checked={preferences.email_weekly_digest}
            onCheckedChange={(checked) => setPreferences({ ...preferences, email_weekly_digest: checked })}
          />
        </div>

        {preferences.email_weekly_digest && (
          <div className="ml-6 space-y-2">
            <Label htmlFor="digest-frequency">Digest Frequency</Label>
            <Select
              value={preferences.digest_frequency}
              onValueChange={(value) => setPreferences({ ...preferences, digest_frequency: value })}
            >
              <SelectTrigger id="digest-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="new-favorites">New Content in Favorites</Label>
            <p className="text-sm text-muted-foreground">Get notified about new content related to your favorites</p>
          </div>
          <Switch
            id="new-favorites"
            checked={preferences.email_new_favorites}
            onCheckedChange={(checked) => setPreferences({ ...preferences, email_new_favorites: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="marketing">Marketing & Updates</Label>
            <p className="text-sm text-muted-foreground">Receive updates about new features and special offers</p>
          </div>
          <Switch
            id="marketing"
            checked={preferences.email_marketing}
            onCheckedChange={(checked) => setPreferences({ ...preferences, email_marketing: checked })}
          />
        </div>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Preferences"}
      </Button>
    </form>
  )
}
