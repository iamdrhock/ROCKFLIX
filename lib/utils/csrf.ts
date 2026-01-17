let csrfTokenCache: string | null = null

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  
  // Check cache first
  if (csrfTokenCache) return csrfTokenCache
  
  const cookies = document.cookie.split(";")
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=")
    if (name === "csrf_token") {
      const token = decodeURIComponent(value)
      csrfTokenCache = token
      return token
    }
  }
  return null
}

/**
 * Fetch CSRF token from server
 */
export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/admin/csrf-token", {
      credentials: "include",
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.csrfToken) {
        csrfTokenCache = data.csrfToken
        console.log("[csrf] CSRF token fetched and cached")
        return data.csrfToken
      } else {
        console.error("[csrf] No CSRF token in response:", data)
      }
    } else {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      console.error("[csrf] Failed to fetch CSRF token:", response.status, errorData)
    }
  } catch (error) {
    console.error("[csrf] Failed to fetch CSRF token:", error)
  }
  
  return null
}

/**
 * Get headers with CSRF token for authenticated requests
 * Will fetch token if not available
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  
  let csrfToken = getCsrfToken()
  console.log("[csrf] Current token from cookie:", csrfToken ? "found" : "not found")
  
  // If no token, try to fetch it
  if (!csrfToken) {
    console.log("[csrf] Fetching new CSRF token...")
    csrfToken = await fetchCsrfToken()
  }
  
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
    console.log("[csrf] Adding CSRF token to headers")
  } else {
    console.error("[csrf] WARNING: No CSRF token available for request!")
  }
  
  return headers
}

