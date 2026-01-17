-- Create email_notifications_log table to track sent emails
CREATE TABLE IF NOT EXISTS email_notifications_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL, -- 'new_episode', 'comment_reply', 'weekly_digest'
  email_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  content_preview TEXT,
  
  -- Related entities
  movie_id BIGINT REFERENCES movies(id) ON DELETE SET NULL,
  episode_id BIGINT REFERENCES episodes(id) ON DELETE SET NULL,
  comment_id BIGINT REFERENCES comments(id) ON DELETE SET NULL,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification log"
  ON email_notifications_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON email_notifications_log FOR ALL
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_user_id ON email_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_type ON email_notifications_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_sent_at ON email_notifications_log(sent_at DESC);
