import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

function getTimeoutMs(defaultValue: number) {
  const value = process.env.SUPABASE_FETCH_TIMEOUT
  if (!value) {
    return defaultValue
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(`[v0] Invalid SUPABASE_FETCH_TIMEOUT value "${value}", falling back to ${defaultValue}ms`)
    return defaultValue
  }

  return parsed
}

const defaultClientTimeout = getTimeoutMs(20000) // 20 seconds for auth + general queries
const defaultServiceRoleTimeout = Math.max(defaultClientTimeout, getTimeoutMs(25000))

export async function createClient() {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Missing Supabase environment variables")
    console.error("[v0] NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "Set" : "Missing")
    console.error(
      "[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:",
      supabaseAnonKey ? "Set (length: " + supabaseAnonKey.length + ")" : "Missing",
    )
    throw new Error("Missing Supabase environment variables")
  }

  console.log("[v0] Creating Supabase client with URL:", supabaseUrl.substring(0, 30) + "...")

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
    db: {
      schema: "public",
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          signal: options.signal || AbortSignal.timeout(defaultClientTimeout),
        })
      },
    },
  })
}

export function createServiceRoleClient() {
  // Use direct Supabase client for service role to bypass RLS
  // Service role key automatically bypasses RLS policies
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: options.signal || AbortSignal.timeout(defaultServiceRoleTimeout),
          })
        },
      },
    }
  )
}

export { createClient as createServerClient }
