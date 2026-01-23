import { Facebook, Twitter, Instagram, Youtube } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { sanitizeHtml } from "@/lib/security/sanitize-html"

async function getSettings() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const res = await fetch(`${apiUrl}/api/settings`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch settings: ${res.status}`)
    }

    const data = await res.json()
    return data
  } catch (error) {
    console.error("[v0] Error in getSettings:", error)
    // Return default settings on error
    return {
      site_title: "ROCKFLIX",
      site_logo_url: null,
      footer_text: "YOUR FAVORITE MOVIES ON ROCKFLIX",
      footer_links: [],
      quick_links: [
        {
          title: "Browse",
          links: [
            { label: "Movies", url: "/movies" },
            { label: "TV Series", url: "/series" },
            { label: "Blog", url: "/blog" },
          ],
        },
        {
          title: "Community",
          links: [
            { label: "TalkFlix", url: "/community" },
            { label: "My Profile", url: "/profile" },
            { label: "Top Rated", url: "/" },
          ],
        },
        {
          title: "Support",
          links: [
            { label: "Admin Dashboard", url: "/arike" },
            { label: "Help Center", url: "/" },
            { label: "Contact Us", url: "/" },
          ],
        },
      ],
      social_links: [],
      footer_custom_code: null,
    }
  }
}

export async function Footer() {
  const settings = await getSettings()

  return (
    <>
      <footer className="border-t border-border bg-card mt-16">
        <div className="container px-4 py-12">
          <div className="flex flex-col items-center gap-6">
            <div className="text-4xl font-bold">
              {settings.site_logo_url ? (
                <Image
                  src={settings.site_logo_url || "/placeholder.svg"}
                  alt={settings.site_title}
                  width={300}
                  height={80}
                  className="h-16 w-auto"
                />
              ) : (
                <>
                  <span className="text-primary">
                    {settings.site_title.slice(0, Math.ceil(settings.site_title.length / 2))}
                  </span>
                  <span className="text-foreground">
                    {settings.site_title.slice(Math.ceil(settings.site_title.length / 2))}
                  </span>
                </>
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground max-w-md">{settings.footer_text}</p>

            {settings.quick_links && settings.quick_links.length > 0 && (
              <div className="w-full max-w-4xl border-t border-b border-border/50 py-8 my-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                  {settings.quick_links.map((column: any, columnIndex: number) => (
                    <div key={columnIndex}>
                      <h3 className="text-sm font-semibold text-foreground mb-3">{column.title}</h3>
                      <ul className="space-y-2">
                        {column.links.map((link: any, linkIndex: number) => (
                          <li key={linkIndex}>
                            <Link
                              href={link.url}
                              className="text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {settings.social_links && settings.social_links.length > 0 && (
              <div className="flex gap-4">
                {settings.social_links.map((link: any, index: number) => (
                  <Link
                    key={index}
                    href={link.url}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
                  >
                    {link.platform === "facebook" && <Facebook className="h-5 w-5 text-primary-foreground" />}
                    {link.platform === "twitter" && <Twitter className="h-5 w-5 text-primary-foreground" />}
                    {link.platform === "instagram" && <Instagram className="h-5 w-5 text-primary-foreground" />}
                    {link.platform === "youtube" && <Youtube className="h-5 w-5 text-primary-foreground" />}
                  </Link>
                ))}
              </div>
            )}

            {settings.footer_links && settings.footer_links.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {settings.footer_links.map((link: any, index: number) => (
                  <Link key={index} href={link.url} className="hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} {settings.site_title}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {settings.footer_custom_code && (
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.footer_custom_code) }} />
      )}
    </>
  )
}
