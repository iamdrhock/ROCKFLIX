-- Create hashtags table
CREATE TABLE IF NOT EXISTS public.hashtags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_hashtags junction table
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id BIGINT NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, hashtag_id)
);

-- Enable RLS
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hashtags
CREATE POLICY "Anyone can view hashtags"
  ON public.hashtags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage hashtags"
  ON public.hashtags FOR ALL
  USING (true);

-- RLS Policies for post_hashtags
CREATE POLICY "Anyone can view post_hashtags"
  ON public.post_hashtags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage post_hashtags"
  ON public.post_hashtags FOR ALL
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS hashtags_name_idx ON public.hashtags(name);
CREATE INDEX IF NOT EXISTS hashtags_post_count_idx ON public.hashtags(post_count DESC);
CREATE INDEX IF NOT EXISTS post_hashtags_post_id_idx ON public.post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS post_hashtags_hashtag_id_idx ON public.post_hashtags(hashtag_id);

-- Function to update hashtag post count
CREATE OR REPLACE FUNCTION update_hashtag_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hashtags SET post_count = post_count + 1 WHERE id = NEW.hashtag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE hashtags SET post_count = post_count - 1 WHERE id = OLD.hashtag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER hashtag_post_count_trigger
AFTER INSERT OR DELETE ON post_hashtags
FOR EACH ROW EXECUTE FUNCTION update_hashtag_post_count();
