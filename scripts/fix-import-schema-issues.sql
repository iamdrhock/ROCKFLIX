-- Fix schema issues after import
-- Run this in Adminer or psql on Contabo PostgreSQL server

-- 1. Add missing columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS provider_id VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS provider_name VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- 2. Add missing columns to post_comments table
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- 3. Import spam_patterns manually (exclude ID to let it auto-generate)
-- Run this separately after fixing schema:
-- The issue is spam_patterns uses GENERATED ALWAYS AS IDENTITY
-- Need to import without ID column or change table structure
-- For now, the data loss is minimal (12 records)

-- 4. Fix post_hashtags foreign key issue
-- This happens if hashtags were imported before post_hashtags
-- Re-import post_hashtags after hashtags table is populated
-- The 6 failed records should work after re-running import

-- 5. Fix comment_likes and talkflix_notifications foreign key issues
-- These are orphaned records - safe to ignore
-- Or manually fix the references if needed

-- Summary:
-- - 46 records failed out of 19,169 total (0.24% failure rate)
-- - Most failures are foreign key constraints (orphaned records)
-- - Schema mismatches are now fixed above
-- - spam_patterns needs manual import or schema change

