import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Dashboard - ROCKFLIX",
  description: "ROCKFLIX Admin Panel",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function ArikeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div data-admin-panel>{children}</div>
}
