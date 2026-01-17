/**
 * Client component to handle cross-domain authentication sync
 * Listens for postMessage events and syncs authentication between domains
 */

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const ROCKFLIX_URL = process.env.NEXT_PUBLIC_MOVIES_URL || "https://rockflix.tv"
const TALKFLIX_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL || "https://talkflix.org"

export function CrossDomainSync() {
  const router = useRouter()

  useEffect(() => {
    // Dynamically import NextAuth only if we're on Rockflix
    let sessionHook: any = null
    
    const initSession = async () => {
      try {
        if (typeof window !== "undefined" && window.location.hostname.includes("rockflix")) {
          const nextAuth = await import("next-auth/react")
          const { useSession } = nextAuth
          // Note: We can't call useSession here because it's a hook
          // Instead, we'll use the session directly when needed
          sessionHook = { getSession: () => nextAuth.getSession() }
        }
      } catch (e) {
        // NextAuth not available, continue without it
        console.log("[Cross-Domain] NextAuth not available")
      }
    }

    initSession()

    // Listen for cross-domain sync messages
    const handleMessage = async (event: MessageEvent) => {
      // Verify message origin
      const isRockflixOrigin = event.origin === ROCKFLIX_URL.replace("https://", "").split("/")[0] ||
                               event.origin === "rockflix.tv"
      const isTalkFlixOrigin = event.origin === TALKFLIX_URL.replace("https://", "").split("/")[0] ||
                               event.origin === "talkflix.org"
      
      if (!isRockflixOrigin && !isTalkFlixOrigin) {
        return // Ignore messages from unknown origins
      }

      if (event.data?.type === "CROSS_DOMAIN_AUTH_SYNC") {
        const { userId, email, from } = event.data

        console.log("[Cross-Domain] Received sync message:", { userId, email, from })

        // If we're on Rockflix and received sync from TalkFlix
        if (window.location.hostname.includes("rockflix") && from === "talkflix") {
          // Refresh the page to pick up session changes
          router.refresh()
          console.log("[Cross-Domain] Updated Rockflix session")
        }

        // If we're on TalkFlix and received sync from Rockflix
        if (window.location.hostname.includes("talkflix") && from === "rockflix") {
          // Refresh Supabase session
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user || user.id !== userId) {
              router.refresh()
            }
          } catch (error) {
            console.error("[Cross-Domain] Error refreshing session:", error)
            router.refresh()
          }
          console.log("[Cross-Domain] Updated TalkFlix session")
        }
      }
    }

    // Listen for postMessage events
    window.addEventListener("message", handleMessage)

    // Check localStorage for sync flags (for same-tab sync)
    const checkSyncFlag = async () => {
      try {
        const syncFlag = localStorage.getItem("auth_sync_needed")
        if (syncFlag) {
          const { userId, email, timestamp } = JSON.parse(syncFlag)
          
          // Only process if flag is recent (within last minute)
          if (Date.now() - timestamp < 60000) {
            console.log("[Cross-Domain] Found sync flag, processing...")
            
            // Clear the flag
            localStorage.removeItem("auth_sync_needed")
            
            // Trigger sync based on current domain
            router.refresh()
          } else {
            // Flag is stale, remove it
            localStorage.removeItem("auth_sync_needed")
          }
        }
      } catch (error) {
        console.error("[Cross-Domain] Error checking sync flag:", error)
      }
    }

    checkSyncFlag()

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [router])

  return null // This component doesn't render anything
}
