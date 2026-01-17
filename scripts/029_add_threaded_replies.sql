-- Add parent_comment_id to support threaded replies
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_comment_id BIGINT REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- Add replies count to track nested replies
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0;

-- Create index for parent comment lookups
CREATE INDEX IF NOT EXISTS post_comments_parent_comment_id_idx ON public.post_comments(parent_comment_id);

-- Function to update comment replies count
CREATE OR REPLACE FUNCTION update_comment_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
    UPDATE post_comments SET replies_count = replies_count + 1 WHERE id = NEW.parent_comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
    UPDATE post_comments SET replies_count = replies_count - 1 WHERE id = OLD.parent_comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comment replies count
DROP TRIGGER IF EXISTS comment_replies_count_trigger ON post_comments;
CREATE TRIGGER comment_replies_count_trigger
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_comment_replies_count();
