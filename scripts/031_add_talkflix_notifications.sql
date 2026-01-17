CREATE TABLE IF NOT EXISTS talkflix_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'like', 'reply', 'follow', 'mention', 'repost', 'quote'
  
  -- Related entities
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
  
  -- Notification content
  content TEXT,
  
  -- Status
  read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE talkflix_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON talkflix_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications"
  ON talkflix_notifications FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Users can update their own notifications"
  ON talkflix_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
  ON talkflix_notifications FOR ALL
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_talkflix_notifications_user_id ON talkflix_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_talkflix_notifications_read ON talkflix_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_talkflix_notifications_created_at ON talkflix_notifications(created_at DESC);

-- Function to create notification for post like
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Create notification
  INSERT INTO talkflix_notifications (user_id, actor_id, notification_type, post_id)
  VALUES (post_owner_id, NEW.user_id, 'like', NEW.post_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for comment
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  parent_comment_owner_id UUID;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- If it's a reply to a comment, notify the comment owner
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO parent_comment_owner_id 
    FROM post_comments 
    WHERE id = NEW.parent_comment_id;
    
    -- Don't notify if user replies to their own comment
    IF parent_comment_owner_id != NEW.user_id THEN
      INSERT INTO talkflix_notifications (user_id, actor_id, notification_type, post_id, comment_id, content)
      VALUES (parent_comment_owner_id, NEW.user_id, 'reply', NEW.post_id, NEW.id, NEW.content);
    END IF;
  END IF;
  
  -- Notify post owner if different from comment author
  IF post_owner_id != NEW.user_id AND (NEW.parent_comment_id IS NULL OR post_owner_id != parent_comment_owner_id) THEN
    INSERT INTO talkflix_notifications (user_id, actor_id, notification_type, post_id, comment_id, content)
    VALUES (post_owner_id, NEW.user_id, 'reply', NEW.post_id, NEW.id, NEW.content);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for follow
CREATE OR REPLACE FUNCTION notify_user_follow()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't notify if user follows themselves
  IF NEW.following_id = NEW.follower_id THEN
    RETURN NEW;
  END IF;
  
  -- Create notification
  INSERT INTO talkflix_notifications (user_id, actor_id, notification_type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for repost
CREATE OR REPLACE FUNCTION notify_post_repost()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Don't notify if user reposts their own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Create notification (different type for quote vs simple repost)
  IF NEW.quote_content IS NOT NULL THEN
    INSERT INTO talkflix_notifications (user_id, actor_id, notification_type, post_id, content)
    VALUES (post_owner_id, NEW.user_id, 'quote', NEW.post_id, NEW.quote_content);
  ELSE
    INSERT INTO talkflix_notifications (user_id, actor_id, notification_type, post_id)
    VALUES (post_owner_id, NEW.user_id, 'repost', NEW.post_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS on_post_like_notify ON post_likes;
CREATE TRIGGER on_post_like_notify
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

DROP TRIGGER IF EXISTS on_post_comment_notify ON post_comments;
CREATE TRIGGER on_post_comment_notify
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_comment();

DROP TRIGGER IF EXISTS on_user_follow_notify ON user_follows;
CREATE TRIGGER on_user_follow_notify
  AFTER INSERT ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_follow();

DROP TRIGGER IF EXISTS on_post_repost_notify ON post_reposts;
CREATE TRIGGER on_post_repost_notify
  AFTER INSERT ON post_reposts
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_repost();
