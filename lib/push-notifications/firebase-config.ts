// Firebase Cloud Messaging Configuration (V1 API)
// Uses service account JSON file for authentication

export const FCM_CONFIG = {
  // Service account JSON (from Firebase Console > Project Settings > Service Accounts)
  // Can be either:
  // 1. Path to JSON file: process.env.FCM_SERVICE_ACCOUNT_PATH
  // 2. JSON string: process.env.FCM_SERVICE_ACCOUNT_JSON
  serviceAccountPath: process.env.FCM_SERVICE_ACCOUNT_PATH || '',
  serviceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON || '',
  
  // Project ID from service account JSON
  projectId: process.env.FCM_PROJECT_ID || '',
  
  // Sender ID (Project Number) from Firebase Console > Project Settings > General
  senderId: process.env.FCM_SENDER_ID || '',
  
  // V1 API endpoint
  get fcmUrl() {
    if (!this.projectId) return ''
    return `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`
  },
}

// Get service account credentials
export function getServiceAccountCredentials() {
  if (FCM_CONFIG.serviceAccountJson) {
    try {
      return JSON.parse(FCM_CONFIG.serviceAccountJson)
    } catch (e) {
      console.error('[FCM] Error parsing service account JSON:', e)
      return null
    }
  }
  
  if (FCM_CONFIG.serviceAccountPath) {
    try {
      const fs = require('fs')
      const path = require('path')
      const fullPath = path.resolve(process.cwd(), FCM_CONFIG.serviceAccountPath)
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    } catch (e) {
      console.error('[FCM] Error reading service account file:', e)
      return null
    }
  }
  
  return null
}

if (!FCM_CONFIG.serviceAccountJson && !FCM_CONFIG.serviceAccountPath && process.env.NODE_ENV === 'production') {
  console.warn('[FCM] Warning: FCM service account not configured. Push notifications will not work.')
}

