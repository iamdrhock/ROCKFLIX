"use client"

import { useEffect, useState } from "react"
import { sanitizeAdHtml } from "@/lib/security/sanitize-html"

interface AdvertProps {
  position: "header" | "detail" | "watch"
  className?: string
}

export function Advert({ position, className = "" }: AdvertProps) {
  const [adContent, setAdContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAdvert() {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const response = await fetch(`/api/advert?position=${position}&t=${Date.now()}`, {
          cache: "no-store",
        })
        
        if (!response.ok) {
          setAdContent(null)
          setIsLoading(false)
          return
        }

        const data = await response.json()
        
        // Only show if active AND has non-empty content
        if (data && data.is_active && data.content && data.content.trim().length > 0) {
          // SECURITY: Sanitize ad content to prevent XSS attacks
          const sanitized = sanitizeAdHtml(data.content.trim())
          setAdContent(sanitized)
        } else {
          // Clear content if inactive or empty
          setAdContent(null)
        }
      } catch (error) {
        console.error(`[Advert] Error fetching advert for position ${position}:`, error)
        setAdContent(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAdvert()
    
    // Re-fetch every 30 seconds to catch updates
    const interval = setInterval(fetchAdvert, 30000)
    
    return () => clearInterval(interval)
  }, [position])

  // Don't render anything if loading, no content, or content is empty
  if (isLoading || !adContent || adContent.trim().length === 0) {
    return null
  }

  return (
    <div
      className={`w-full flex items-center justify-center ${className}`}
      dangerouslySetInnerHTML={{ __html: adContent }}
    />
  )
}

