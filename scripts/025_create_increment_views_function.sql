-- Create a function to safely increment movie views
-- This prevents race conditions when multiple users watch simultaneously

CREATE OR REPLACE FUNCTION increment_movie_views(movie_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE movies 
  SET views = COALESCE(views, 0) + 1,
      updated_at = NOW()
  WHERE id = movie_id;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION increment_movie_views(BIGINT) TO anon, authenticated;
