-- Function to increment repost count
CREATE OR REPLACE FUNCTION increment_repost_count(post_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET repost_count = COALESCE(repost_count, 0) + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement repost count
CREATE OR REPLACE FUNCTION decrement_repost_count(post_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET repost_count = GREATEST(COALESCE(repost_count, 0) - 1, 0)
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
