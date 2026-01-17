-- Create series_followers table for users to follow TV series
CREATE TABLE IF NOT EXISTS series_followers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, series_id)
);

-- Enable RLS
ALTER TABLE series_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own followed series"
  ON series_followers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can follow series"
  ON series_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow series"
  ON series_followers FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON series_followers FOR ALL
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_series_followers_user_id ON series_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_series_followers_series_id ON series_followers(series_id);
