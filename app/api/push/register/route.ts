import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth/nextauth-helpers'
import { queryContabo } from '@/lib/database/contabo-pool'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { device_token, platform, device_info, app_version } = body

    if (!device_token || !platform) {
      return NextResponse.json(
        { error: 'device_token and platform are required' },
        { status: 400 }
      )
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    try {
      if (useContabo) {
        // Upsert device token
        await queryContabo(
          `INSERT INTO push_notification_tokens (user_id, device_token, platform, device_info, app_version, is_active, last_used_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
           ON CONFLICT (device_token)
           DO UPDATE SET
             user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             device_info = EXCLUDED.device_info,
             app_version = EXCLUDED.app_version,
             is_active = true,
             last_used_at = NOW(),
             updated_at = NOW()`,
          [
            userId,
            device_token,
            platform,
            device_info ? JSON.stringify(device_info) : null,
            app_version || null,
          ]
        )
      } else {
        const supabase = createServiceRoleClient()
        const { error } = await supabase
          .from('push_notification_tokens')
          .upsert(
            {
              user_id: userId,
              device_token,
              platform,
              device_info: device_info || null,
              app_version: app_version || null,
              is_active: true,
              last_used_at: new Date().toISOString(),
            },
            {
              onConflict: 'device_token',
            }
          )

        if (error) throw error
      }

      return NextResponse.json({ success: true, message: 'Device token registered' })
    } catch (error: any) {
      console.error('[Push] Error registering device token:', error)
      return NextResponse.json({ error: 'Failed to register device token' }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Push] Error in register route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAuthSession()

    const userId = (session?.user as { id?: string | null } | null)?.id || null
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { device_token } = body

    if (!device_token) {
      return NextResponse.json({ error: 'device_token is required' }, { status: 400 })
    }

    const useContabo = process.env.USE_CONTABO_DB === 'true'

    try {
      if (useContabo) {
        await queryContabo(
          `UPDATE push_notification_tokens
           SET is_active = false, updated_at = NOW()
           WHERE device_token = $1 AND user_id = $2`,
          [device_token, userId]
        )
      } else {
        const supabase = createServiceRoleClient()
        const { error } = await supabase
          .from('push_notification_tokens')
          .update({ is_active: false })
          .eq('device_token', device_token)
          .eq('user_id', userId)

        if (error) throw error
      }

      return NextResponse.json({ success: true, message: 'Device token unregistered' })
    } catch (error: any) {
      console.error('[Push] Error unregistering device token:', error)
      return NextResponse.json({ error: 'Failed to unregister device token' }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Push] Error in delete route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

