-- Add likes and dislikes count columns to post_comments
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;

-- Create table for comment likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL, -- true for like, false for dislike
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comment_likes
CREATE POLICY "Anyone can view comment likes"
ON public.comment_likes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can react to comments"
ON public.comment_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their comment reactions"
ON public.comment_likes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their comment reactions"
ON public.comment_likes FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON public.comment_likes(user_id);

-- Trigger function to update comment likes/dislikes count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_like THEN
            UPDATE post_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE post_comments SET dislikes_count = dislikes_count + 1 WHERE id = NEW.comment_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_like THEN
            UPDATE post_comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
        ELSE
            UPDATE post_comments SET dislikes_count = dislikes_count - 1 WHERE id = OLD.comment_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If user changed from like to dislike or vice versa
        IF OLD.is_like != NEW.is_like THEN
            IF NEW.is_like THEN
                UPDATE post_comments SET likes_count = likes_count + 1, dislikes_count = dislikes_count - 1 WHERE id = NEW.comment_id;
            ELSE
                UPDATE post_comments SET likes_count = likes_count - 1, dislikes_count = dislikes_count + 1 WHERE id = NEW.comment_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS comment_likes_count_trigger ON comment_likes;
CREATE TRIGGER comment_likes_count_trigger
AFTER INSERT OR DELETE OR UPDATE ON comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();
