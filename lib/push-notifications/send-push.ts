import { FCM_CONFIG, getServiceAccountCredentials } from './firebase-config'

interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
  imageUrl?: string
}

interface SendPushOptions {
  tokens: string[] // Array of device tokens
  payload: PushNotificationPayload
  priority?: 'high' | 'normal'
}

/**
 * Get OAuth2 access token for FCM V1 API
 */
async function getAccessToken(): Promise<string> {
  const credentials = getServiceAccountCredentials()
  if (!credentials) {
    throw new Error('FCM service account not configured')
  }

  // Use google-auth-library for OAuth2
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
      project_id: credentials.project_id,
    },
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })

  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()
  
  if (!accessToken.token) {
    throw new Error('Failed to get access token')
  }

  return accessToken.token
}

/**
 * Send push notification via Firebase Cloud Messaging V1 API
 */
export async function sendPushNotification(options: SendPushOptions): Promise<{
  success: boolean
  successCount: number
  failureCount: number
  results: Array<{ token: string; success: boolean; error?: string }>
}> {
  const { tokens, payload, priority = 'high' } = options

  if (!FCM_CONFIG.fcmUrl) {
    throw new Error('FCM_PROJECT_ID not configured')
  }

  if (tokens.length === 0) {
    return {
      success: true,
      successCount: 0,
      failureCount: 0,
      results: [],
    }
  }

  // FCM V1 API sends one message at a time (no batch support)
  // But we can send them in parallel with Promise.all
  const allResults: Array<{ token: string; success: boolean; error?: string }> = []
  let totalSuccess = 0
  let totalFailure = 0

  // Get access token once for all requests
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch (error: any) {
    // All tokens failed due to auth error
    tokens.forEach((token) => {
      allResults.push({
        token,
        success: false,
        error: error.message || 'Authentication failed',
      })
      totalFailure++
    })
    return {
      success: false,
      successCount: 0,
      failureCount: tokens.length,
      results: allResults,
    }
  }

  // Send notifications in parallel (limit to 100 concurrent)
  const concurrencyLimit = 100
  for (let i = 0; i < tokens.length; i += concurrencyLimit) {
    const batch = tokens.slice(i, i + concurrencyLimit)
    
    const batchPromises = batch.map(async (token) => {
      try {
        // Build FCM V1 message format
        const fcmMessage = {
          message: {
            token: token,
            notification: {
              title: payload.title,
              body: payload.body,
              ...(payload.imageUrl && { image: payload.imageUrl }),
            },
            data: payload.data ? Object.fromEntries(
              Object.entries(payload.data).map(([key, value]) => [
                key,
                typeof value === 'string' ? value : JSON.stringify(value),
              ])
            ) : undefined,
            android: {
              priority: priority === 'high' ? 'high' : 'normal',
            },
          },
        }

        const response = await fetch(FCM_CONFIG.fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(fcmMessage),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: await response.text() }))
          throw new Error(errorData.error?.message || `HTTP ${response.status}`)
        }

        const result = await response.json()
        
        // V1 API returns success if name field is present
        if (result.name) {
          return { token, success: true }
        } else {
          return { token, success: false, error: 'Unknown error' }
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error'
        
        // Check for invalid token errors
        if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('INVALID_ARGUMENT')) {
          console.log(`[FCM] Invalid token detected: ${token.substring(0, 20)}...`)
        }
        
        return { token, success: false, error: errorMessage }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    
    batchResults.forEach((result) => {
      allResults.push(result)
      if (result.success) {
        totalSuccess++
      } else {
        totalFailure++
      }
    })
  }

  return {
    success: totalSuccess > 0,
    successCount: totalSuccess,
    failureCount: totalFailure,
    results: allResults,
  }
}

/**
 * Send push notification to all active tokens
 */
export async function sendBroadcastPush(
  payload: PushNotificationPayload,
  options?: {
    platform?: 'android' | 'ios' | 'web' | 'all'
    limit?: number
  }
): Promise<{
  success: boolean
  successCount: number
  failureCount: number
  totalTokens: number
}> {
  // Import here to avoid circular dependencies
  const { queryContabo } = await import('@/lib/database/contabo-pool')
  const { createServiceRoleClient } = await import('@/lib/supabase/server')

  const useContabo = process.env.USE_CONTABO_DB === 'true'
  const { platform = 'all', limit } = options || {}

  let tokens: Array<{ device_token: string }> = []

  try {
    if (useContabo) {
      let sql = `
        SELECT device_token
        FROM push_notification_tokens
        WHERE is_active = true
      `
      const params: any[] = []
      
      if (platform !== 'all') {
        sql += ` AND platform = $1`
        params.push(platform)
      }
      
      sql += ` ORDER BY last_used_at DESC`
      
      if (limit) {
        sql += ` LIMIT $${params.length + 1}`
        params.push(limit)
      }

      const result = await queryContabo<{ device_token: string }>(sql, params)
      tokens = result.rows
    } else {
      const supabase = createServiceRoleClient()
      let query = supabase
        .from('push_notification_tokens')
        .select('device_token')
        .eq('is_active', true)
        .order('last_used_at', { ascending: false })

      if (platform !== 'all') {
        query = query.eq('platform', platform)
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw error
      tokens = (data || []) as Array<{ device_token: string }>
    }

    if (tokens.length === 0) {
      return {
        success: true,
        successCount: 0,
        failureCount: 0,
        totalTokens: 0,
      }
    }

    const deviceTokens = tokens.map((t) => t.device_token)
    const result = await sendPushNotification({
      tokens: deviceTokens,
      payload,
    })

    return {
      success: result.success,
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalTokens: tokens.length,
    }
  } catch (error: any) {
    console.error('[FCM] Error in sendBroadcastPush:', error)
    throw error
  }
}

