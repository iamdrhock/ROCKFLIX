"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"

interface Notification {
  id: number
  notification_type: string
  post_id?: number
  comment_id?: number
  content?: string
  read: boolean
  created_at: string
  actor: {
    id: string
    username: string
    profile_picture_url?: string
  }
}

export function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 20

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async (loadMore = false) => {
    setIsLoading(true)
    try {
      const currentOffset = loadMore ? offset : 0
      const response = await fetch(`/api/notifications/talkflix?limit=${limit}&offset=${currentOffset}`)
      if (response.ok) {
        const data = await response.json()
        if (loadMore) {
          setNotifications((prev) => [...prev, ...data])
        } else {
          setNotifications(data)
        }
        setHasMore(data.length === limit)
        setOffset(currentOffset + data.length)
      }
    } catch (error) {
      console.error("[v0] Error fetching notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch("/api/notifications/talkflix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId], markAsRead: true }),
      })
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)))
    } catch (error) {
      console.error("[v0] Error marking as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/talkflix/mark-all-read", { method: "POST" })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (error) {
      console.error("[v0] Error marking all as read:", error)
    }
  }

  const getNotificationText = (notification: Notification) => {
    const { notification_type, actor } = notification
    switch (notification_type) {
      case "like":
        return `${actor.username} liked your post`
      case "reply":
        return `${actor.username} replied to your post`
      case "follow":
        return `${actor.username} followed you`
      case "repost":
        return `${actor.username} reposted your post`
      case "quote":
        return `${actor.username} quoted your post`
      default:
        return `${actor.username} interacted with your content`
    }
  }

  const getNotificationLink = (notification: Notification) => {
    if (notification.post_id) {
      return `/community?post=${notification.post_id}`
    }
    if (notification.actor) {
      return `/profile/${notification.actor.username}`
    }
    return "/community"
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all as read ({unreadCount})
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No notifications yet</Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`p-4 hover:bg-accent/50 transition-colors ${!notification.read ? "bg-accent/30" : ""}`}
            >
              <Link
                href={getNotificationLink(notification)}
                onClick={() => !notification.read && markAsRead(notification.id)}
                className="flex gap-4"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={notification.actor.profile_picture_url || "/placeholder.svg"} />
                  <AvatarFallback>{notification.actor.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{getNotificationText(notification)}</p>
                  {notification.content && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{notification.content}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notification.read && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
              </Link>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => fetchNotifications(true)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
