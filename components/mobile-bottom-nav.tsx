"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Film, Tv, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const pathname = usePathname()

  // Hardcode community URL to avoid environment variable issues
  const COMMUNITY_URL = "https://talkflix.org"
  
  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
    },
    {
      label: "Movies",
      href: "/movies",
      icon: Film,
    },
    {
      label: "Series",
      href: "/series",
      icon: Tv,
    },
    {
      label: "Chat",
      href: `${COMMUNITY_URL}/community`,
      icon: MessageCircle,
    },
  ]

  return (
    <>
      {/* Bottom Navigation Bar - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border/40 shadow-lg safe-area-inset-bottom">
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            // Better active state detection
            let isActive = false
            if (item.href === "/") {
              isActive = pathname === "/"
            } else {
              isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-200",
                  "active:scale-95",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium transition-all duration-200",
                    isActive && "font-semibold"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

