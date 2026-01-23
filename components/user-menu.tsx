"use client"

import Link from "next/link"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { User, Settings, Heart, Bookmark } from "lucide-react"
import { SignOutButton } from "@/components/sign-out-button"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

interface Profile {
  username: string | null
  profile_picture_url: string | null
}

export function UserMenu({ showTalkFlixSettings = false }: { showTalkFlixSettings?: boolean }) {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const user = session?.user

  useEffect(() => {
    // Fetch profile when user is available
    if (user?.id) {
      fetch(`/api/user/profile?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.profile) {
            setProfile(data.profile)
          }
        })
        .catch((error) => {
          console.error("[UserMenu] Error fetching profile:", error)
        })
    } else {
      setProfile(null)
    }
  }, [user?.id])

  // Show loading state while checking session
  if (status === "loading") return null

  // Don't show menu if not logged in
  if (!user) return null

  const displayName = profile?.username || user.name || user.email?.split("@")[0] || "User"
  const avatarUrl = profile?.profile_picture_url || user.image

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex flex-col items-center gap-1 cursor-pointer">
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl || "/placeholder.svg"}
                alt={displayName}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">My Profile</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showTalkFlixSettings ? (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/community/profile/${profile?.username}`} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>TalkFlix Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/community/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Edit Profile</span>
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile/my-watchlist" className="cursor-pointer">
                <Bookmark className="mr-2 h-4 w-4" />
                <span>My Watchlist</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile/my-favorites" className="cursor-pointer">
                <Heart className="mr-2 h-4 w-4" />
                <span>My Favorites</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <SignOutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

