import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign Up - ROCKFLIX",
  description: "Create your ROCKFLIX account",
  robots: "noindex, nofollow",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
