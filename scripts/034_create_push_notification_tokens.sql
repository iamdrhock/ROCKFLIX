-- Create push_notification_tokens table for FCM device tokens
CREATE TABLE IF NOT EXISTS push_notification_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'android', 'ios', 'web'
  device_info JSONB, -- Store device name, model, OS version, etc.
  app_version VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(device_token)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_notification_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_notification_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON push_notification_tokens(user_id, is_active);

-- Create push_notifications_log table to track sent notifications
CREATE TABLE IF NOT EXISTS push_notifications_log (
  id BIGSERIAL PRIMARY KEY,
  notification_type VARCHAR(100) NOT NULL, -- 'broadcast', 'targeted', 'episode_alert', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional payload data
  target_user_ids UUID[], -- NULL for broadcast to all
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Admin who sent it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_created_at ON push_notifications_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_log_type ON push_notifications_log(notification_type);

