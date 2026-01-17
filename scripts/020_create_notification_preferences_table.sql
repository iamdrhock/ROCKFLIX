-- Create notification_preferences table for email notification settings
CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email notification toggles
  email_new_episodes BOOLEAN DEFAULT true,
  email_comment_replies BOOLEAN DEFAULT true,
  email_weekly_digest BOOLEAN DEFAULT true,
  email_new_favorites BOOLEAN DEFAULT false,
  email_marketing BOOLEAN DEFAULT false,
  
  -- Digest frequency
  digest_frequency VARCHAR(50) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly', 'never'
  
  -- Tracking
  last_digest_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON notification_preferences FOR ALL
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Create function to auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create preferences on profile creation
DROP TRIGGER IF EXISTS on_profile_created_create_notification_preferences ON profiles;
CREATE TRIGGER on_profile_created_create_notification_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();
