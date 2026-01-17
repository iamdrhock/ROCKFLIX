import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login - ROCKFLIX",
  description: "Sign in to your ROCKFLIX account",
  robots: "noindex, nofollow",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
