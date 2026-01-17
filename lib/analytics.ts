import { createClient } from "@/lib/supabase/client"

export interface ViewEvent {
  movieId: number
  duration?: number
  completion?: number
  playerUsed?: string
  deviceType?: string
  browser?: string
}

export interface SearchEvent {
  query: string
  resultsCount?: number
  clickedResultId?: number
}

export interface PlayerError {
  movieId: number
  playerUsed: string
  errorType: string
  errorMessage?: string
}

// Track a view event
export async function trackView(event: ViewEvent) {
  try {
    console.log('[analytics] trackView called for movie:', event.movieId)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const sessionId = getSessionId()
    console.log('[analytics] Session ID:', sessionId, 'User ID:', user?.id || 'anonymous')

    const payload = {
      movie_id: event.movieId,
      user_id: user?.id || null,
      session_id: sessionId,
      view_duration: event.duration || null,
      completion_percentage: event.completion || null,
      player_used: event.playerUsed || null,
      device_type: event.deviceType || getDeviceType(),
      browser: event.browser || getBrowser(),
    }
    
    console.log('[analytics] Sending track-view request:', payload)

    // Use API route to handle Contabo writes server-side
    const response = await fetch('/api/analytics/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[analytics] track-view API error:', response.status, errorText)
      throw new Error(`API error: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log('[analytics] track-view API success:', result)
  } catch (error) {
    console.error("[analytics] Error tracking view:", error)
  }
}

// Track a search event
export async function trackSearch(event: SearchEvent) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const sessionId = getSessionId()

    // Use API route to handle Contabo writes server-side
    await fetch('/api/analytics/track-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: event.query,
        user_id: user?.id || null,
        session_id: sessionId,
        results_count: event.resultsCount || null,
        clicked_result_id: event.clickedResultId || null,
        device_type: getDeviceType(),
      }),
    }).catch(err => {
      console.error('[v0] Error calling track-search API:', err)
    })
  } catch (error) {
    console.error("[v0] Error tracking search:", error)
  }
}

// Track a player error
export async function trackPlayerError(error: PlayerError) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const sessionId = getSessionId()

    // Use API route to handle Contabo writes server-side
    await fetch('/api/analytics/track-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        movie_id: error.movieId,
        user_id: user?.id || null,
        session_id: sessionId,
        player_used: error.playerUsed,
        error_type: error.errorType,
        error_message: error.errorMessage || null,
        device_type: getDeviceType(),
        browser: getBrowser(),
      }),
    }).catch(err => {
      console.error('[v0] Error calling track-error API:', err)
    })
  } catch (error) {
    console.error("[v0] Error tracking player error:", error)
  }
}

// Helper functions
function getSessionId(): string {
  if (typeof window === "undefined") return "server"

  let sessionId = sessionStorage.getItem("analytics_session_id")
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    sessionStorage.setItem("analytics_session_id", sessionId)
  }
  return sessionId
}

function getDeviceType(): string {
  if (typeof window === "undefined") return "unknown"

  const ua = navigator.userAgent
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet"
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return "mobile"
  }
  return "desktop"
}

function getBrowser(): string {
  if (typeof window === "undefined") return "unknown"

  const ua = navigator.userAgent
  if (ua.indexOf("Firefox") > -1) return "Firefox"
  if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera"
  if (ua.indexOf("Trident") > -1) return "IE"
  if (ua.indexOf("Edge") > -1) return "Edge"
  if (ua.indexOf("Chrome") > -1) return "Chrome"
  if (ua.indexOf("Safari") > -1) return "Safari"
  return "unknown"
}
