import { NextResponse } from "next/server"
import { adminRoute } from "@/lib/security/admin-middleware"

export const GET = adminRoute(async (context) => {
    const { adminUser } = context
    const SEARCH_TERM = "%99fkw4w8%"
    const results: any = {}

    try {
        // 1. Check Contabo (Primary Production DB)
        if (process.env.USE_CONTABO_DB === 'true') {
            try {
                const { queryContabo } = await import('@/lib/database/contabo-pool')

                // Scan Advertisements
                const adsResult = await queryContabo(
                    `SELECT id, position, content FROM advertisements 
             WHERE content ILIKE $1`,
                    [SEARCH_TERM]
                )
                if (adsResult.rows.length > 0) results.advertisements = adsResult.rows

                // Scan Site Settings
                const settingsResult = await queryContabo(
                    `SELECT id, site_title, footer_text FROM site_settings 
             WHERE footer_text ILIKE $1 OR site_title ILIKE $1`,
                    [SEARCH_TERM]
                )
                if (settingsResult.rows.length > 0) results.site_settings = settingsResult.rows

                // Scan Posts (TalkFlix)
                const postsResult = await queryContabo(
                    `SELECT id, content FROM posts 
             WHERE content ILIKE $1 LIMIT 5`,
                    [SEARCH_TERM]
                )
                if (postsResult.rows.length > 0) results.posts = postsResult.rows

                // Scan Comments
                const commentsResult = await queryContabo(
                    `SELECT id, content FROM comments
             WHERE content ILIKE $1 LIMIT 5`,
                    [SEARCH_TERM]
                )
                if (commentsResult.rows.length > 0) results.comments = commentsResult.rows

            } catch (e: any) {
                results.contabo_error = e.message
            }
        }

        // 2. Check Supabase (Fallback/Legacy)
        // We'll just check advertisements here as it's the most likely
        try {
            const { createClient } = await import("@/lib/supabase/server")
            const supabase = await createClient()

            const { data: maliciousAds } = await supabase
                .from("advertisements")
                .select("id, position, content")
                .ilike("content", SEARCH_TERM)

            if (maliciousAds && maliciousAds.length > 0) {
                results.supabase_advertisements = maliciousAds
            }
        } catch (e: any) {
            results.supabase_error = e.message
        }

        return NextResponse.json({
            success: true,
            scanned_term: "99fkw4w8",
            findings: results
        })

    } catch (error: any) {
        return NextResponse.json(
            { error: "Scan failed", details: error.message },
            { status: 500 }
        )
    }
})
