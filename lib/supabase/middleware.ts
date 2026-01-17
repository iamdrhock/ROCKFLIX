import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes that require authentication
  const protectedRoutes = ["/settings", "/community/bookmarks"]
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  // Check if user needs to complete profile
  if (
    user &&
    request.nextUrl.pathname !== "/auth/complete-profile" &&
    request.nextUrl.pathname !== "/community/auth/complete-profile"
  ) {
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()

    if (!profile?.username) {
      // User needs to complete profile - redirect based on current path
      const url = request.nextUrl.clone()
      if (request.nextUrl.pathname.startsWith("/community")) {
        url.pathname = "/community/auth/complete-profile"
      } else {
        url.pathname = "/auth/complete-profile"
      }
      return NextResponse.redirect(url)
    }
  }

  // Only redirect to login if accessing a protected route without auth
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
