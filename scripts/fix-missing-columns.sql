-- Fix Missing Columns for Contabo Import
-- Run this in Adminer → SQL command before importing data

-- Fix site_settings table
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_movie_watch_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_series_watch_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS theme_color TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watch_page_middle_custom_html TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_cache BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_ttl_minutes INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_image_optimization BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS max_movies_per_page INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_lazy_loading BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS database_query_timeout INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS email_from TEXT;

-- Fix comment_likes table
ALTER TABLE comment_likes ADD COLUMN IF NOT EXISTS is_like BOOLEAN;

-- Fix comments table (add any missing columns)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_reason TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_by UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_by UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE;

-- Done!
SELECT 'Missing columns added successfully!' AS status;

