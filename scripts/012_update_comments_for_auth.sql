-- Update comments table to make user_id required and deprecate user_name for authenticated users
-- This script ensures comments are properly linked to authenticated users

-- Add a check constraint to ensure either user_id is set (for authenticated users)
-- or user_name is set (for legacy/guest comments if needed)
ALTER TABLE comments 
ADD CONSTRAINT comments_user_check 
CHECK (user_id IS NOT NULL OR user_name IS NOT NULL);

-- Update RLS policies for comments to ensure users can only edit their own comments
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Add index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Add index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
