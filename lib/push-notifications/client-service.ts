'use client'

/**
 * Client-side push notification service
 * Handles device token registration and notification permissions
 */

interface DeviceInfo {
  platform: string
  userAgent: string
  language: string
  timezone: string
}

export class PushNotificationService {
  private static instance: PushNotificationService
  private registrationService: any = null

  private constructor() {
    // Initialize Capacitor Push Notifications if available
    if (typeof window !== 'undefined') {
      this.initializeCapacitor()
    }
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService()
    }
    return PushNotificationService.instance
  }

  private async initializeCapacitor() {
    try {
      // Dynamically import Capacitor to avoid SSR issues
      const { PushNotifications } = await import('@capacitor/push-notifications')
      this.registrationService = PushNotifications
    } catch (error) {
      console.log('[Push] Capacitor Push Notifications not available (web mode)')
    }
  }

  /**
   * Register device token with server
   */
  async registerToken(deviceToken: string, deviceInfo?: DeviceInfo): Promise<boolean> {
    try {
      const platform = await this.getPlatform()
      const info = deviceInfo || await this.getDeviceInfo()

      const response = await fetch('/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          device_token: deviceToken,
          platform,
          device_info: info,
          app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to register device token')
      }

      return true
    } catch (error) {
      console.error('[Push] Error registering token:', error)
      return false
    }
  }

  /**
   * Request notification permission and register for push notifications
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (this.registrationService) {
        // Capacitor (Native app)
        const status = await this.registrationService.requestPermissions()
        
        if (status.receive === 'granted') {
          // Register with FCM
          await this.registrationService.register()
          
          // Listen for registration
          this.registrationService.addListener('registration', async (token: any) => {
            await this.registerToken(token.value)
          })

          // Listen for push notifications
          this.registrationService.addListener('pushNotificationReceived', (notification: any) => {
            console.log('[Push] Notification received:', notification)
            // Handle notification when app is in foreground
            this.showLocalNotification(notification)
          })

          // Handle notification tap
          this.registrationService.addListener('pushNotificationActionPerformed', (notification: any) => {
            console.log('[Push] Notification action:', notification)
            // Navigate to relevant page based on notification data
            if (notification.notification.data?.url) {
              window.location.href = notification.notification.data.url
            }
          })

          return true
        }
      } else {
        // Web (PWA) - Use Web Push API
        if ('Notification' in window && 'serviceWorker' in navigator) {
          const permission = await Notification.requestPermission()
          
          if (permission === 'granted') {
            // Register service worker for push
            const registration = await navigator.serviceWorker.ready
            
            // Subscribe to push notifications (requires VAPID key)
            // For now, we'll use FCM web push which handles subscription differently
            // This would need additional setup with Firebase Web SDK
            
            return true
          }
        }
      }

      return false
    } catch (error) {
      console.error('[Push] Error requesting permission:', error)
      return false
    }
  }

  /**
   * Unregister device token
   */
  async unregisterToken(deviceToken: string): Promise<boolean> {
    try {
      const response = await fetch('/api/push/register', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ device_token: deviceToken }),
      })

      return response.ok
    } catch (error) {
      console.error('[Push] Error unregistering token:', error)
      return false
    }
  }

  /**
   * Show local notification (for foreground notifications)
   */
  private showLocalNotification(notification: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title || 'ROCKFLIX', {
        body: notification.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: notification.id || 'rockflix-notification',
        data: notification.data,
      })
    }
  }

  /**
   * Get current platform
   */
  private async getPlatform(): Promise<'android' | 'ios' | 'web'> {
    if (typeof window === 'undefined') return 'web'

    if (this.registrationService) {
      const { Capacitor } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      return platform === 'ios' ? 'ios' : 'android'
    }

    return 'web'
  }

  /**
   * Get device information
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      platform: await this.getPlatform(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance()

