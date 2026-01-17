/**
 * Cross-Domain Authentication Sync
 * 
 * This utility helps sync authentication between Rockflix (NextAuth) and TalkFlix (Supabase)
 * When a user logs in on one domain, we sync their session to the other domain
 */

const ROCKFLIX_URL = process.env.NEXT_PUBLIC_MOVIES_URL || "https://rockflix.tv"
const TALKFLIX_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL || "https://talkflix.org"

/**
 * Sync NextAuth session to TalkFlix (Supabase)
 * This is called when a user logs in on Rockflix
 */
export async function syncToTalkFlix(userId: string, email: string): Promise<void> {
  try {
    // Call TalkFlix sync endpoint
    const response = await fetch(`${TALKFLIX_URL}/api/auth/sync-from-rockflix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important for cookies
      body: JSON.stringify({
        userId,
        email,
      }),
    })

    if (!response.ok) {
      console.error("[Cross-Domain] Failed to sync to TalkFlix:", await response.text())
    } else {
      console.log("[Cross-Domain] Successfully synced to TalkFlix")
    }
  } catch (error) {
    console.error("[Cross-Domain] Error syncing to TalkFlix:", error)
    // Don't throw - login should still succeed even if sync fails
  }
}

/**
 * Sync Supabase session to Rockflix (NextAuth)
 * This is called when a user logs in on TalkFlix
 */
export async function syncToRockflix(userId: string, email: string): Promise<void> {
  try {
    // Call Rockflix sync endpoint
    const response = await fetch(`${ROCKFLIX_URL}/api/auth/sync-from-talkflix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important for cookies
      body: JSON.stringify({
        userId,
        email,
      }),
    })

    if (!response.ok) {
      console.error("[Cross-Domain] Failed to sync to Rockflix:", await response.text())
    } else {
      console.log("[Cross-Domain] Successfully synced to Rockflix")
    }
  } catch (error) {
    console.error("[Cross-Domain] Error syncing to Rockflix:", error)
    // Don't throw - login should still succeed even if sync fails
  }
}

/**
 * Client-side function to trigger cross-domain sync via iframe/postMessage
 * This works even if cookies are blocked by preventing CORS issues
 */
export function triggerCrossDomainSync(targetDomain: "rockflix" | "talkflix", userId: string, email: string) {
  if (typeof window === "undefined") return

  const targetUrl = targetDomain === "rockflix" ? ROCKFLIX_URL : TALKFLIX_URL
  const syncUrl = `${targetUrl}/api/auth/cross-domain-sync?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&from=${encodeURIComponent(window.location.hostname)}`

  // Use iframe to trigger sync on the other domain
  const iframe = document.createElement("iframe")
  iframe.style.display = "none"
  iframe.style.width = "1px"
  iframe.style.height = "1px"
  iframe.src = syncUrl

  // Remove iframe after a delay
  document.body.appendChild(iframe)
  setTimeout(() => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe)
    }
  }, 3000)

  console.log(`[Cross-Domain] Triggered sync to ${targetDomain} via iframe`)
}

