import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { adminRoute } from "@/lib/security/admin-middleware"

/**
 * Verify which database the application is actually using
 * This checks the Supabase connection since that's what the code uses
 */
export const GET = adminRoute(async ({ request }) => {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const databaseUrl = process.env.DATABASE_URL || ""

    // Determine database type
    let dbType = "Unknown"
    let dbHost = ""
    
    if (supabaseUrl) {
      if (supabaseUrl.includes("supabase.co")) {
        dbType = "Supabase"
        dbHost = supabaseUrl.split("//")[1]?.split(".")[0] || supabaseUrl
      } else if (supabaseUrl.includes("ondigitalocean.com")) {
        dbType = "DigitalOcean (via Supabase client)"
        dbHost = supabaseUrl
      } else {
        dbType = "Custom PostgreSQL (via Supabase client)"
        dbHost = supabaseUrl
      }
    }

    // Test actual connection using Supabase client (what the app uses)
    let connectionTest: any = {
      status: "not_tested",
      error: null,
    }

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createServiceRoleClient()
        
        // Test connection by querying a known table (movies)
        const { count: moviesCount, error: moviesError } = await supabase
          .from("movies")
          .select("*", { count: "exact", head: true })
        
        if (moviesError) {
          connectionTest = {
            status: "error",
            error: moviesError.message,
          }
        } else {
          // Count records in key tables
          const counts: Record<string, number> = {}
          const keyTables = ["movies", "genres", "actors", "site_settings", "admin_users", "posts", "comments", "profiles"]
          
          for (const table of keyTables) {
            try {
              const { count, error } = await supabase
                .from(table)
                .select("*", { count: "exact", head: true })
              
              if (!error && count !== null) {
                counts[table] = count
              }
            } catch (error) {
              // Table might not exist, skip it
              counts[table] = -1
            }
          }

          // Get sample of movies to verify it's working
          const { data: sampleMovies } = await supabase
            .from("movies")
            .select("id, title, type")
            .limit(3)

          connectionTest = {
            status: "connected",
            tables: Object.keys(counts).filter(k => counts[k] >= 0).length,
            recordCounts: counts,
            sampleData: sampleMovies || [],
            totalRecords: Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0),
          }
        }
      } catch (error) {
        connectionTest = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }

    return NextResponse.json({
      success: true,
      environment: {
        // What the code is using
        applicationDatabase: {
          type: dbType,
          host: dbHost,
          url: supabaseUrl ? supabaseUrl.substring(0, 50) + "..." : "Not set",
          hasAnonKey: !!supabaseAnonKey,
          hasServiceKey: !!supabaseServiceKey,
        },
        // What's in env but not used
        unusedDatabaseUrl: {
          exists: !!databaseUrl,
          host: databaseUrl.includes("ondigitalocean.com") 
            ? "DigitalOcean" 
            : databaseUrl.includes("supabase.co")
            ? "Supabase"
            : "Other",
          url: databaseUrl ? databaseUrl.split("@")[1]?.split("/")[0] || "masked" : "Not set",
        },
      },
      connectionTest,
      conclusion: {
        activeDatabase: connectionTest.status === "connected" 
          ? dbType 
          : "Unable to determine",
        recommendation: connectionTest.status === "connected" && dbType === "Supabase"
          ? "??? Your application is using Supabase. Migrate from Supabase to Contabo."
          : connectionTest.status === "connected"
          ? "??? Your application is connected. Verify if you want to migrate."
          : "??? Unable to connect. Check your environment variables.",
      },
    })
  } catch (error) {
    console.error("[admin/verify-current-db] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
})

