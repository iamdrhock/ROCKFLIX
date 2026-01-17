import { adminRoute } from "@/lib/security/admin-middleware"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

export const GET = adminRoute(async ({ supabase }) => {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_logo_url, header_menu, footer_links, footer_text")
      .single()

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse(data)
  } catch (error: any) {
    console.error("Error fetching settings:", error)
    return jsonResponse({ error: "Failed to fetch settings" }, 500)
  }
})

export const POST = adminRoute(async ({ request, supabase }) => {
  try {
    const body = await request.json()

    const { site_logo_url, header_menu, footer_links, footer_text } = body

    const { error } = await supabase
      .from("site_settings")
      .update({
        site_logo_url,
        header_menu,
        footer_links,
        footer_text,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    console.error("Error updating settings:", error)
    return jsonResponse({ error: "Failed to update settings" }, 500)
  }
})
