-- Create favorites table for public favorite movies/series
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, movie_id)
);

-- Enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can add to their own favorites
CREATE POLICY "Users can add to their own favorites"
  ON favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove from their own favorites
CREATE POLICY "Users can remove from their own favorites"
  ON favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Anyone can view favorites (public)
CREATE POLICY "Anyone can view favorites"
  ON favorites
  FOR SELECT
  TO public
  USING (true);

-- Policy: Service role has full access
CREATE POLICY "Service role has full access"
  ON favorites
  FOR ALL
  TO service_role
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_movie_id ON favorites(movie_id);
