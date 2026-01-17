-- COMPLETE FIX FOR ALL MISSING COLUMNS
-- Run this ONCE in Adminer → SQL command, then import SQL files

-- ============================================================================
-- SITE_SETTINGS - Add ALL possible columns
-- ============================================================================
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_movie_watch_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_series_watch_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS theme_color TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watch_page_middle_custom_html TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_cache BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_enabled BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_ttl_movies INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_ttl_trending INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_ttl_genres INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_ttl_minutes INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_image_optimization BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS compress_images BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS max_movies_per_page INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS max_items_per_page INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_lazy_loading BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS database_query_timeout INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS email_from TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS quick_links JSONB;

-- ============================================================================
-- COMMENT_LIKES - Add missing column
-- ============================================================================
ALTER TABLE comment_likes ADD COLUMN IF NOT EXISTS is_like BOOLEAN;

-- ============================================================================
-- COMMENTS - Add moderation columns
-- ============================================================================
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_reason TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_by UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_by UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id BIGINT REFERENCES comments(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;

-- ============================================================================
-- POST_COMMENTS - Add missing columns
-- ============================================================================
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id BIGINT REFERENCES post_comments(id);
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;

-- ============================================================================
-- PROFILES - Add any missing columns
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comments_posted INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comments_approved INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comments_flagged INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS muted_reason TEXT;

-- ============================================================================
-- POSTS - Add any missing columns
-- ============================================================================
ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_post_id BIGINT REFERENCES posts(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reply_to_post_id BIGINT REFERENCES posts(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- ACTORS - Add any missing columns
-- ============================================================================
ALTER TABLE actors ADD COLUMN IF NOT EXISTS imdb_id VARCHAR(20);
ALTER TABLE actors ADD COLUMN IF NOT EXISTS bio TEXT;

-- ============================================================================
-- GENRES - Add slug column if missing
-- ============================================================================
ALTER TABLE genres ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- ============================================================================
-- TAGS - Add any missing columns
-- ============================================================================
ALTER TABLE tags ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- ============================================================================
-- MOVIES - Add any missing columns
-- ============================================================================
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tmdb_id VARCHAR(50);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS director VARCHAR(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS production VARCHAR(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE movies ADD COLUMN IF NOT EXISTS runtime INTEGER;

-- ============================================================================
-- EPISODES - Add any missing columns
-- ============================================================================
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS runtime INTEGER;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS tmdb_id VARCHAR(50);

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'All missing columns added successfully!' AS status;

