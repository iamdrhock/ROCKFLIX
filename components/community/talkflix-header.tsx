"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { UserMenu } from "@/components/user-menu"
import { NotificationsDropdown } from "@/components/community/notifications-dropdown"
import { TalkFlixSearch } from "@/components/community/talkflix-search"
import { Button } from "@/components/ui/button"
import { Home, User, LogIn } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface HeaderMenuItem {
  label: string
  url: string
}

interface HeaderData {
  logo_url: string | null
  menu_items: HeaderMenuItem[]
}

export function TalkFlixHeader() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [headerData, setHeaderData] = useState<HeaderData>({
    logo_url: null,
    menu_items: [],
  })
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    async function loadHeaderData() {
      const { data, error } = await supabase.from("site_settings").select("site_logo_url, header_menu").single()

      if (data && !error) {
        setHeaderData({
          logo_url: data.site_logo_url,
          menu_items: (data.header_menu as HeaderMenuItem[]) || [],
        })
      }
    }

    loadHeaderData()
  }, [supabase])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/community" className="flex items-center gap-2 flex-shrink-0">
          <div className="text-2xl font-bold">
            <span className="text-red-500">Talk</span>
            <span className="text-white">Flix</span>
          </div>
        </Link>

        <div className="hidden md:block flex-1 max-w-md">
          <TalkFlixSearch />
        </div>

        <nav className="hidden lg:flex items-center gap-4 flex-shrink-0">
          <Link
            href="/community"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Feed
          </Link>
          {headerData.menu_items.map((item, index) => (
            <Link
              key={index}
              href={item.url}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          {user && <NotificationsDropdown />}
          {user ? (
            <UserMenu showTalkFlixSettings />
          ) : (
            <>
              <Link href="/community/auth/login">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <LogIn className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Login</span>
                </Button>
              </Link>
              <Link href="/community/auth/sign-up">
                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                  <User className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Sign Up</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
