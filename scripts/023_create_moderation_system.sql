-- Content Moderation System
-- Adds moderation features to comments and user reputation tracking

-- Add moderation fields to comments table
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flagged_reason text,
ADD COLUMN IF NOT EXISTS flagged_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS flagged_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_spam boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS spam_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'approved', -- pending, approved, rejected, hidden
ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS moderated_at timestamp with time zone;

-- Add reputation fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS reputation_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_posted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_approved integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_flagged integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS muted_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS muted_reason text;

-- Create moderation_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamp with time zone DEFAULT now(),
  moderator_id uuid REFERENCES auth.users(id),
  action text NOT NULL, -- ban, unban, mute, unmute, flag_comment, approve_comment, reject_comment
  target_type text NOT NULL, -- user, comment
  target_id text NOT NULL,
  reason text,
  details jsonb
);

-- Create spam_patterns table for tracking spam detection
CREATE TABLE IF NOT EXISTS public.spam_patterns (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamp with time zone DEFAULT now(),
  pattern text NOT NULL,
  pattern_type text NOT NULL, -- keyword, url, regex
  severity integer DEFAULT 1, -- 1-10, higher = more severe
  is_active boolean DEFAULT true
);

-- Create user_reports table for community reporting
CREATE TABLE IF NOT EXISTS public.user_reports (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamp with time zone DEFAULT now(),
  reporter_id uuid REFERENCES auth.users(id),
  reported_user_id uuid REFERENCES auth.users(id),
  comment_id bigint REFERENCES comments(id),
  reason text NOT NULL,
  report_type text NOT NULL, -- spam, harassment, inappropriate, other
  status text DEFAULT 'pending', -- pending, reviewed, resolved, dismissed
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  resolution_notes text
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_flagged ON comments(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_comments_spam ON comments(is_spam) WHERE is_spam = true;
CREATE INDEX IF NOT EXISTS idx_comments_moderation_status ON comments(moderation_status);
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON profiles(reputation_score);
CREATE INDEX IF NOT EXISTS idx_profiles_muted ON profiles(is_muted) WHERE is_muted = true;
CREATE INDEX IF NOT EXISTS idx_moderation_logs_target ON moderation_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);

-- Enable RLS
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for moderation_logs
CREATE POLICY "Service role has full access to moderation logs"
  ON moderation_logs FOR ALL
  USING (true);

-- RLS Policies for spam_patterns
CREATE POLICY "Service role has full access to spam patterns"
  ON spam_patterns FOR ALL
  USING (true);

-- RLS Policies for user_reports
CREATE POLICY "Users can view their own reports"
  ON user_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports"
  ON user_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Service role has full access to reports"
  ON user_reports FOR ALL
  USING (true);

-- Insert default spam patterns
INSERT INTO spam_patterns (pattern, pattern_type, severity, is_active) VALUES
('viagra', 'keyword', 8, true),
('cialis', 'keyword', 8, true),
('casino', 'keyword', 7, true),
('lottery', 'keyword', 6, true),
('click here', 'keyword', 5, true),
('buy now', 'keyword', 5, true),
('limited offer', 'keyword', 4, true),
('act now', 'keyword', 4, true),
('http://', 'url', 3, true),
('https://', 'url', 2, true),
('bit.ly', 'url', 6, true),
('tinyurl', 'url', 6, true)
ON CONFLICT DO NOTHING;

-- Function to calculate user reputation
CREATE OR REPLACE FUNCTION calculate_user_reputation(user_id_param uuid)
RETURNS integer AS $$
DECLARE
  rep_score integer;
BEGIN
  SELECT 
    (comments_approved * 10) - (comments_flagged * 20)
  INTO rep_score
  FROM profiles
  WHERE id = user_id_param;
  
  RETURN COALESCE(rep_score, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to check spam score for text
CREATE OR REPLACE FUNCTION check_spam_score(comment_text_param text)
RETURNS integer AS $$
DECLARE
  spam_score_result integer := 0;
  pattern_record RECORD;
BEGIN
  FOR pattern_record IN 
    SELECT pattern, severity 
    FROM spam_patterns 
    WHERE is_active = true
  LOOP
    IF LOWER(comment_text_param) LIKE '%' || LOWER(pattern_record.pattern) || '%' THEN
      spam_score_result := spam_score_result + pattern_record.severity;
    END IF;
  END LOOP;
  
  RETURN spam_score_result;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON COLUMN comments.is_flagged IS 'Whether the comment has been flagged for review';
COMMENT ON COLUMN comments.spam_score IS 'Calculated spam score (higher = more likely spam)';
COMMENT ON COLUMN comments.moderation_status IS 'Current moderation status: pending, approved, rejected, hidden';
COMMENT ON TABLE moderation_logs IS 'Log of all moderation actions taken by admins';
COMMENT ON TABLE spam_patterns IS 'Patterns used for automatic spam detection';
COMMENT ON TABLE user_reports IS 'User-submitted reports for inappropriate content';
