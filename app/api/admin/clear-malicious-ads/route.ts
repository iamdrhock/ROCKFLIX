import { NextRequest, NextResponse } from "next/server"
import { adminRoute } from "@/lib/security/admin-middleware"

export const POST = adminRoute(async (context) => {
  const { supabase, adminUser } = context

  try {
    console.log(`[admin/clear-malicious-ads] Admin ${adminUser.username} clearing malicious ads`)

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { queryContabo } = await import('@/lib/database/contabo-pool')
        
        // Clear malicious ads
        const clearResult = await queryContabo(
          `UPDATE advertisements 
           SET 
             content = '',
             is_active = false,
             updated_at = NOW()
           WHERE 
             content ILIKE '%<script%' OR
             content ILIKE '%javascript:%' OR
             content ILIKE '%onerror=%' OR
             content ILIKE '%onload=%' OR
             content ILIKE '%onclick=%' OR
             content ILIKE '%eval(%' OR
             content ILIKE '%document.write%' OR
             content ILIKE '%window.open%' OR
             content ILIKE '%popup%' OR
             content ILIKE '%pop-up%'`
        )

        // Get count of cleared ads
        const countResult = await queryContabo<{ count: number }>(
          `SELECT COUNT(*) as count FROM advertisements WHERE content = '' AND is_active = false`
        )

        return NextResponse.json({
          success: true,
          cleared: countResult.rows[0]?.count || 0,
          message: "Malicious ads cleared successfully"
        })
      } catch (contaboError: any) {
        console.error("[admin/clear-malicious-ads] Contabo error:", contaboError)
        // Fall through to Supabase
      }
    }

    // Fallback to Supabase
    // First, find malicious ads
    const { data: maliciousAds } = await supabase
      .from("advertisements")
      .select("id, position, content")
      .or("content.ilike.%<script%,content.ilike.%javascript:%,content.ilike.%onerror=%,content.ilike.%onload=%,content.ilike.%onclick=%,content.ilike.%eval(%,content.ilike.%document.write%,content.ilike.%window.open%,content.ilike.%popup%,content.ilike.%pop-up%")

    if (maliciousAds && maliciousAds.length > 0) {
      // Clear malicious ads
      const { error: updateError } = await supabase
        .from("advertisements")
        .update({
          content: "",
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", maliciousAds.map(ad => ad.id))

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({
        success: true,
        cleared: maliciousAds.length,
        message: `Cleared ${maliciousAds.length} malicious ad(s)`,
        positions: maliciousAds.map(ad => ad.position)
      })
    }

    return NextResponse.json({
      success: true,
      cleared: 0,
      message: "No malicious ads found"
    })
  } catch (error: any) {
    console.error("[admin/clear-malicious-ads] Error:", error)
    return NextResponse.json(
      { error: "Failed to clear malicious ads", details: error.message },
      { status: 500 }
    )
  }
})

