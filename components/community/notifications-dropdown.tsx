"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

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

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch("/api/notifications/talkflix/count")
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count)
      }
    } catch (error) {
      console.error("[v0] Error fetching notification count:", error)
    }
  }

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/notifications/talkflix?limit=10")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error("[v0] Error fetching notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notificationIds: number[]) => {
    try {
      await fetch("/api/notifications/talkflix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds, markAsRead: true }),
      })
      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length))
      setNotifications((prev) => prev.map((n) => (notificationIds.includes(n.id) ? { ...n, read: true } : n)))
    } catch (error) {
      console.error("[v0] Error marking as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/talkflix/mark-all-read", { method: "POST" })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (error) {
      console.error("[v0] Error marking all as read:", error)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      fetchNotifications()
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

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              asChild
              className={`p-3 cursor-pointer ${!notification.read ? "bg-accent/50" : ""}`}
              onClick={() => !notification.read && markAsRead([notification.id])}
            >
              <Link href={getNotificationLink(notification)} className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={notification.actor.profile_picture_url || "/placeholder.svg"} />
                  <AvatarFallback>{notification.actor.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{getNotificationText(notification)}</p>
                  {notification.content && (
                    <p className="text-xs text-muted-foreground truncate mt-1">{notification.content}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notification.read && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="justify-center">
              <Link href="/notifications" className="text-center w-full">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
