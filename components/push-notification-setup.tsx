'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCircle2, XCircle } from 'lucide-react'
import { pushNotificationService } from '@/lib/push-notifications/client-service'

export function PushNotificationSetup() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  useEffect(() => {
    checkPermissionStatus()
  }, [])

  const checkPermissionStatus = async () => {
    if (typeof window === 'undefined') return

    try {
      if ('Notification' in window) {
        const permission = Notification.permission
        setHasPermission(permission === 'granted')
        setIsEnabled(permission === 'granted')
      } else {
        // Check if Capacitor is available
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          // For native apps, assume permission is handled by the app
          setHasPermission(true)
          setIsEnabled(true)
        } else {
          setHasPermission(false)
        }
      }
    } catch (error) {
      console.error('[Push] Error checking permission:', error)
      setHasPermission(false)
    }
  }

  const handleEnable = async () => {
    setIsLoading(true)
    try {
      const granted = await pushNotificationService.requestPermission()
      if (granted) {
        setIsEnabled(true)
        setHasPermission(true)
      } else {
        alert('Push notification permission denied. Please enable it in your browser/app settings.')
      }
    } catch (error) {
      console.error('[Push] Error enabling notifications:', error)
      alert('Failed to enable push notifications. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable = async () => {
    setIsLoading(true)
    try {
      // Note: Browser doesn't allow programmatic disabling of notifications
      // User must disable in browser settings
      setIsEnabled(false)
      setHasPermission(false)
      alert('To disable push notifications, please disable them in your browser/app settings.')
    } catch (error) {
      console.error('[Push] Error disabling notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (hasPermission === null) {
    return null // Loading state
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        {isEnabled ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-gray-400" />
        )}
        <div>
          <p className="font-medium">Push Notifications</p>
          <p className="text-sm text-muted-foreground">
            {isEnabled
              ? 'You will receive notifications for new episodes and updates'
              : 'Get notified about new episodes and important updates'}
          </p>
        </div>
      </div>
      {isEnabled ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisable}
          disabled={isLoading}
        >
          <BellOff className="h-4 w-4 mr-2" />
          Disable
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={handleEnable}
          disabled={isLoading}
        >
          <Bell className="h-4 w-4 mr-2" />
          {isLoading ? 'Enabling...' : 'Enable'}
        </Button>
      )}
    </div>
  )
}

