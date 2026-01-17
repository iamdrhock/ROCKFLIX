import React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { createClient } from "@supabase/supabase-js"
import { NextAuthSessionProvider } from "@/components/providers/session-provider"
import { CrossDomainSync } from "@/components/cross-domain-sync"
import { ServiceWorkerRegister } from "./sw-register"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

async function getSettings() {
  try {
    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { fetchSiteSettingsFromContabo } = await import('@/lib/database/contabo-queries')
      const settings = await fetchSiteSettingsFromContabo()
      if (settings) {
        return {
          site_title: settings.site_title || "M4UHDTV - Your Favorite Movies & TV Shows",
          site_description: settings.site_description || "Stream the latest movies and TV shows in HD quality",
          site_favicon_url: settings.site_favicon_url || null,
          site_logo_url: settings.site_logo_url || null,
        }
      }
    }

    // Fallback to Supabase
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const { data, error } = await supabase
      .from("site_settings")
      .select("site_title, site_description, site_favicon_url, site_logo_url")
      .single()

    if (error) throw error
    return data
  } catch (error) {
    return {
      site_title: "M4UHDTV - Your Favorite Movies & TV Shows",
      site_description:
        "Stream the latest movies and TV shows in HD quality. Watch trending content, discover new releases, and enjoy unlimited entertainment.",
      site_favicon_url: null,
      site_logo_url: null,
    }
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

  return {
    title: {
      default: settings.site_title,
      template: `%s | ${settings.site_title}`,
    },
    description: settings.site_description,
    generator: "v0.app",
    applicationName: settings.site_title,
    keywords: ["movies", "tv shows", "streaming", "watch movies", "free movies", "HD movies", "entertainment"],
    authors: [{ name: settings.site_title }],
    creator: settings.site_title,
    publisher: settings.site_title,
    metadataBase: new URL(siteUrl),
    manifest: '/manifest.json',
    alternates: {
      canonical: siteUrl,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: settings.site_title,
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'format-detection': 'telephone=no',
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName: settings.site_title,
      title: settings.site_title,
      description: settings.site_description,
      images: [
        {
          url: settings.site_logo_url || `${siteUrl}/placeholder.svg?height=630&width=1200&query=movies`,
          width: 1200,
          height: 630,
          alt: settings.site_title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.site_title,
      description: settings.site_description,
      images: [settings.site_logo_url || `${siteUrl}/placeholder.svg?height=630&width=1200&query=movies`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      // Users can add their verification codes via site settings in the future
    },
    ...(settings.site_favicon_url && {
      icons: {
        icon: settings.site_favicon_url,
      },
    }),
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={_geist.className}>
        <NextAuthSessionProvider>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1 pb-16 md:pb-0">
              {children}
            </div>
            <MobileBottomNav />
          </div>
          <CrossDomainSync />
          <ServiceWorkerRegister />
        </NextAuthSessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
