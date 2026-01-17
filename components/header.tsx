import Link from "next/link"
import Image from "next/image"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { SearchBox } from "@/components/search-box"
import { MobileNavBar } from "@/components/mobile-nav-bar"
import { NavDropdown } from "@/components/nav-dropdown"
import { UserMenu } from "@/components/user-menu"
import { NotificationsDropdown } from "@/components/community/notifications-dropdown"
import { GENRES, COUNTRIES } from "@/lib/navigation-data"
import { Button } from "@/components/ui/button"
import { User, LogIn } from "lucide-react"
import { Advert } from "@/components/advert"
import { sanitizeHtml } from "@/lib/security/sanitize-html"

async function getSettings() {
  try {
    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
        const settings = await fetchSiteSettingsFromContabo()
        if (settings) {
          console.log("[v0] Settings fetched successfully from Contabo:", {
            hasLogo: !!settings.site_logo_url,
            logoUrl: settings.site_logo_url,
            title: settings.site_title,
          })
          return settings
        }
      } catch (contaboError) {
        console.error("[v0] Error fetching settings from Contabo, falling back to Supabase:", contaboError)
        // Fall through to Supabase fallback
      }
    }

    // Fallback to Supabase
    try {
      const supabase = await createServerClient()
      const { data, error } = await supabase.from("site_settings").select("*").single()

      if (error) {
        console.error("[v0] Error fetching settings from Supabase:", error)
        throw error
      }

      console.log("[v0] Settings fetched successfully from Supabase:", {
        hasLogo: !!data.site_logo_url,
        logoUrl: data.site_logo_url,
        title: data.site_title,
      })

      return data
    } catch (supabaseError) {
      console.error("[v0] Error fetching settings from Supabase:", supabaseError)
      throw supabaseError
    }
  } catch (error) {
    console.error("[v0] Error in getSettings:", error)
    // Return default settings
    return {
      site_title: "M4UHDTV",
      site_logo_url: null,
      header_menu: [
        { label: "Home", url: "/" },
        { label: "Movies", url: "/movies" },
        { label: "TV Shows", url: "/series" },
        { label: "Genres", url: "/genres" },
      ],
      header_custom_code: null,
    }
  }
}

export async function Header() {
  // Load settings and session in parallel to avoid blocking
  // Add timeout to session check to prevent hanging page load
  const [settings, session] = await Promise.all([
    getSettings(),
    // Use NextAuth for authentication - wrap in timeout to avoid blocking page load
    (async () => {
      try {
        const { getAuthSession } = await import("@/lib/auth/nextauth-helpers")
        // getAuthSession already has timeout protection, but add extra safety
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 2000) // 2 second timeout for header
        })
        const sessionPromise = getAuthSession()
        return await Promise.race([sessionPromise, timeoutPromise])
      } catch (error) {
        console.error("[Header] Error getting session:", error)
        return null
      }
    })(),
  ])
  
  const user = session?.user || null

  return (
    <>
      {settings.header_custom_code && (
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.header_custom_code) }} />
      )}

      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-20 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            {settings.site_logo_url ? (
              <Image
                src={settings.site_logo_url || "/placeholder.svg"}
                alt={settings.site_title}
                width={400}
                height={112}
                className="h-16 w-auto max-w-full"
                priority
              />
            ) : (
              <div className="text-2xl font-bold">
                <span className="text-primary">M4U</span>
                <span className="text-foreground">HDTV</span>
              </div>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {settings.header_menu?.map((item: { label: string; url: string }) => (
              <Link key={item.url} href={item.url} className="text-sm font-medium hover:text-primary transition-colors">
                {item.label}
              </Link>
            ))}
            <Link href="/community" className="text-sm font-medium hover:text-primary transition-colors">
              TalkFlix
            </Link>
            <NavDropdown label="Genre" items={GENRES} columns={4} />
            <NavDropdown label="Country" items={COUNTRIES} columns={4} />
          </nav>

          <div className="flex md:hidden items-center gap-2">
            {user?.id && <NotificationsDropdown />}
            {user?.id ? (
              <UserMenu />
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="h-9 px-3">
                    <LogIn className="h-4 w-4 mr-1" />
                    Login
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button size="sm" className="h-9 px-3">
                    <User className="h-4 w-4 mr-1" />
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2">
            {user?.id && <NotificationsDropdown />}
            {user?.id ? (
              <UserMenu />
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="md:hidden border-t border-border/40">
          <MobileNavBar menuItems={settings.header_menu || []} />
        </div>
      </header>

      <div className="container px-4 py-4">
        <SearchBox />
      </div>

      <div className="container px-4 pb-4">
        <Advert position="header" className="w-full mb-4" />
      </div>
    </>
  )
}
