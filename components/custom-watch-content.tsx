"use client"

import { useEffect, useState } from "react"
import { sanitizeHtml } from "@/lib/security/sanitize-html"

export function CustomWatchContent() {
  const [customHtml, setCustomHtml] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCustomContent() {
      try {
        const response = await fetch("/api/settings")
        if (response.ok) {
          const settings = await response.json()
          // SECURITY: Sanitize HTML to prevent XSS attacks
          const sanitized = sanitizeHtml(settings.watch_page_custom_html || "")
          setCustomHtml(sanitized)
        }
      } catch (error) {
        console.error("[v0] Error fetching custom watch content:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomContent()
  }, [])

  if (loading || !customHtml) {
    return null
  }

  return <div className="mb-6" dangerouslySetInnerHTML={{ __html: customHtml }} />
}
