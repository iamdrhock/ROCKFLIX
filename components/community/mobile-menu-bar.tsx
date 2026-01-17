"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Home } from "lucide-react"

interface HeaderMenuItem {
  label: string
  url: string
}

export function MobileMenuBar() {
  const [menuItems, setMenuItems] = useState<HeaderMenuItem[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function loadMenuItems() {
      const { data, error } = await supabase.from("site_settings").select("header_menu").single()

      if (data && !error) {
        setMenuItems((data.header_menu as HeaderMenuItem[]) || [])
      }
    }

    loadMenuItems()
  }, [supabase])

  return (
    <div className="lg:hidden border-b border-border/40 bg-black/95 backdrop-blur sticky top-16 z-40">
      <div className="container px-4">
        <nav className="flex items-center gap-4 overflow-x-auto py-3 scrollbar-hide">
          <Link
            href="/community"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Home className="h-4 w-4" />
            Feed
          </Link>
          {menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.url}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
