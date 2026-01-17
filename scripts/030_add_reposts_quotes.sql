CREATE TABLE IF NOT EXISTS public.post_reposts (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Add indexes for repost queries
CREATE INDEX IF NOT EXISTS post_reposts_post_id_idx ON public.post_reposts(post_id);
CREATE INDEX IF NOT EXISTS post_reposts_user_id_idx ON public.post_reposts(user_id);

-- Enable RLS for reposts
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reposts"
  ON public.post_reposts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can repost"
  ON public.post_reposts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their reposts"
  ON public.post_reposts FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update repost count
CREATE OR REPLACE FUNCTION update_post_repost_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET repost_count = repost_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for repost count
CREATE TRIGGER post_repost_count_trigger
AFTER INSERT OR DELETE ON post_reposts
FOR EACH ROW EXECUTE FUNCTION update_post_repost_count();
