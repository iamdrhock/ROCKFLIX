import { NextResponse } from 'next/server'
import { adminRoute } from '@/lib/security/admin-middleware'
import { sendBroadcastPush } from '@/lib/push-notifications/send-push'
import { queryContabo } from '@/lib/database/contabo-pool'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const POST = adminRoute(async ({ request, supabase: adminSupabase }) => {
  try {
    const body = await request.json()
    const { title, body: message, data, image_url, platform, limit } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      )
    }

    // Get admin user ID for logging
    const session = await import('@/lib/auth/nextauth-helpers').then(m => m.getAuthSession())
    const adminUserId = (session?.user as { id?: string | null } | null)?.id ?? null

    // Send push notification
    const result = await sendBroadcastPush(
      {
        title,
        body: message,
        data: data || {},
        imageUrl: image_url,
      },
      {
        platform: platform || 'all',
        limit: limit || undefined,
      }
    )

    // Log the notification
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    
    try {
      if (useContabo) {
        await queryContabo(
          `INSERT INTO push_notifications_log 
           (notification_type, title, body, data, target_user_ids, total_sent, total_failed, total_tokens, sent_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            'broadcast',
            title,
            message,
            JSON.stringify(data || {}),
            null, // Broadcast to all
            result.successCount,
            result.failureCount,
            result.totalTokens,
            adminUserId,
          ]
        )
      } else {
        const supabase = await import('@/lib/supabase/server').then(m => m.createServiceRoleClient())
        await supabase.from('push_notifications_log').insert({
          notification_type: 'broadcast',
          title,
          body: message,
          data: data || {},
          target_user_ids: null,
          total_sent: result.successCount,
          total_failed: result.failureCount,
          total_tokens: result.totalTokens,
          sent_by: adminUserId,
        })
      }
    } catch (logError) {
      console.error('[Push] Error logging notification:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Push notification sent',
      results: {
        totalTokens: result.totalTokens,
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
    })
  } catch (error: any) {
    console.error('[Push] Error sending push notification:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send push notification' },
      { status: 500 }
    )
  }
})

