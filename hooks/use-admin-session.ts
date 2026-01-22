"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export function useAdminSession() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (status === "loading") return

        if (!session || session.user.role !== "admin") {
            // If we're not on the login page, redirect to login
            if (pathname !== "/api/auth/signin" && !pathname?.includes("/auth/login")) {
                // Optionally redirect or just let the page handle it
                // But usually admin pages want protection
                // For now, let's assuming pages handle their own redirects or we do it here
                // Given usage in import-movies checks authLoading, we should probably set loading to false eventually
            }
        }

        setLoading(false)
    }, [session, status, pathname, router])

    return {
        session,
        status,
        loading: status === "loading" || loading,
        isAdmin: session?.user?.role === "admin"
    }
}
