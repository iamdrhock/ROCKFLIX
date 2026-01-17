import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchSiteSettingsFromContabo } from "@/lib/database/contabo-queries"

export const dynamic = "force-dynamic"

const getDefaultSettings = () => ({
  site_title: "M4UHDTV",
  site_description: "Stream the latest movies and TV shows in HD quality",
  site_logo_url: null,
  site_favicon_url: null,
  header_menu: [
    { label: "Home", url: "/" },
    { label: "Movies", url: "/movies" },
    { label: "TV Shows", url: "/series" },
    { label: "Genres", url: "/genres" },
  ],
  footer_links: [
    { label: "DMCA", url: "/dmca" },
    { label: "FAQs", url: "/faqs" },
    { label: "Contact", url: "/contact" },
    { label: "Sitemap", url: "/sitemap" },
  ],
  social_links: [
    { platform: "facebook", url: "#" },
    { platform: "twitter", url: "#" },
    { platform: "instagram", url: "#" },
    { platform: "youtube", url: "#" },
  ],
  footer_text: "YOUR FAVORITE MOVIES ON M4UHDTV",
})

export async function GET() {
  try {
    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      console.log("[api/settings] Fetching settings from Contabo...")
      const data = await fetchSiteSettingsFromContabo()
      
      if (!data) {
        console.error("[api/settings] Error fetching settings from Contabo: Settings not found, using defaults")
        return NextResponse.json(getDefaultSettings())
      }

      console.log("[api/settings] Successfully fetched settings from Contabo")
      return NextResponse.json(data)
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single()

    if (error) {
      console.error("Error fetching settings:", error)
      return NextResponse.json(getDefaultSettings())
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in settings API:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}
