-- Create hashtags table
CREATE TABLE IF NOT EXISTS public.hashtags (
  id BIGSERIAL PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS hashtags_tag_idx ON public.hashtags(tag);
CREATE INDEX IF NOT EXISTS hashtags_usage_count_idx ON public.hashtags(usage_count DESC);
CREATE INDEX IF NOT EXISTS post_hashtags_post_id_idx ON public.post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS post_hashtags_hashtag_id_idx ON public.post_hashtags(hashtag_id);

-- Function to extract and store hashtags from post content
CREATE OR REPLACE FUNCTION process_post_hashtags()
RETURNS TRIGGER AS $$
DECLARE
  hashtag_match TEXT;
  hashtag_id BIGINT;
BEGIN
  -- Delete existing hashtags for this post
  DELETE FROM post_hashtags WHERE post_id = NEW.id;
  
  -- Extract all hashtags from content
  FOR hashtag_match IN 
    SELECT DISTINCT lower(regexp_replace(match[1], '#', '')) 
    FROM regexp_matches(NEW.content, '#(\w+)', 'g') AS match
  LOOP
    -- Insert or update hashtag
    INSERT INTO hashtags (tag, usage_count)
    VALUES (hashtag_match, 1)
    ON CONFLICT (tag) 
    DO UPDATE SET 
      usage_count = hashtags.usage_count + 1,
      updated_at = NOW()
    RETURNING id INTO hashtag_id;
    
    -- Link hashtag to post
    INSERT INTO post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, hashtag_id);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process hashtags on post insert/update
CREATE TRIGGER process_hashtags_trigger
AFTER INSERT OR UPDATE OF content ON posts
FOR EACH ROW EXECUTE FUNCTION process_post_hashtags();

-- Function to update hashtag usage count when post is deleted
CREATE OR REPLACE FUNCTION cleanup_hashtag_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hashtags
  SET usage_count = usage_count - 1,
      updated_at = NOW()
  WHERE id = OLD.hashtag_id;
  
  -- Optionally delete hashtags with 0 usage
  DELETE FROM hashtags WHERE usage_count <= 0;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for hashtag cleanup
CREATE TRIGGER cleanup_hashtag_trigger
AFTER DELETE ON post_hashtags
FOR EACH ROW EXECUTE FUNCTION cleanup_hashtag_count();
