"use client"

import { useEffect } from "react"

/**
 * Component to inject preconnect hints for VidPlus and ad networks
 * This runs immediately on mount to establish connections early
 */
export function VidPlusPreconnect() {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const domains = [
      'https://player.vidplus.to',
      'https://vidplus.to',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://pagead2.googlesyndication.com',
      'https://tpc.googlesyndication.com',
    ]

    domains.forEach(domain => {
      // Check if link already exists
      const existing = document.querySelector(`link[href="${domain}"]`)
      if (existing) return

      // Preconnect for faster connection
      const link1 = document.createElement('link')
      link1.rel = 'preconnect'
      link1.href = domain
      link1.crossOrigin = 'anonymous'
      document.head.appendChild(link1)

      // DNS prefetch as fallback
      const link2 = document.createElement('link')
      link2.rel = 'dns-prefetch'
      link2.href = domain
      document.head.appendChild(link2)
    })
  }, [])

  return null
}

