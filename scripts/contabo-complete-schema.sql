-- RockFlix Complete Database Schema for Contabo PostgreSQL
-- This script creates all tables with their constraints and indexes
-- Run this in your Contabo PostgreSQL database via Adminer

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Create actors table
CREATE TABLE IF NOT EXISTS actors (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    name VARCHAR(255),
    photo_url TEXT,
    imdb_id VARCHAR(20) UNIQUE,
    bio TEXT
);

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create movies table
CREATE TABLE IF NOT EXISTS movies (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500),
    description TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    trailer_url TEXT,
    release_date VARCHAR(50),
    duration VARCHAR(50),
    rating NUMERIC(3, 1),
    quality VARCHAR(50),
    type VARCHAR(50),
    country VARCHAR(255),
    imdb_id VARCHAR(50),
    tmdb_id VARCHAR(50),
    total_seasons INTEGER,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    season_number INTEGER,
    title VARCHAR(500),
    episode_count INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER,
    title VARCHAR(500),
    description TEXT,
    release_date VARCHAR(50),
    imdb_id VARCHAR(50),
    tmdb_id VARCHAR(50),
    runtime INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- JUNCTION TABLES
-- ============================================================================

-- Create movie_genres junction table
CREATE TABLE IF NOT EXISTS movie_genres (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    genre_id BIGINT REFERENCES genres(id) ON DELETE CASCADE,
    UNIQUE(movie_id, genre_id)
);

-- Create movie_countries junction table
CREATE TABLE IF NOT EXISTS movie_countries (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    country_id BIGINT REFERENCES countries(id) ON DELETE CASCADE,
    UNIQUE(movie_id, country_id)
);

-- Create movie_actors junction table
CREATE TABLE IF NOT EXISTS movie_actors (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES actors(id) ON DELETE CASCADE,
    character_name VARCHAR(500)
);

-- Create movie_tags junction table
CREATE TABLE IF NOT EXISTS movie_tags (
    movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, tag_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- USER TABLES
-- ============================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    profile_picture_url TEXT,
    role TEXT DEFAULT 'user',
    about TEXT,
    country TEXT,
    is_banned BOOLEAN DEFAULT false,
    banned_reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    reputation_score INTEGER DEFAULT 0,
    comments_posted INTEGER DEFAULT 0,
    comments_approved INTEGER DEFAULT 0,
    comments_flagged INTEGER DEFAULT 0,
    is_muted BOOLEAN DEFAULT false,
    muted_until TIMESTAMP WITH TIME ZONE,
    muted_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ADMIN TABLES
-- ============================================================================

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    password_hash TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITHOUT TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITHOUT TIME ZONE
);

-- Create admin_sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- ============================================================================
-- CONTENT TABLES
-- ============================================================================

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user_name VARCHAR(255),
    comment_text TEXT,
    parent_comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    is_flagged boolean DEFAULT false,
    flagged_reason text,
    flagged_by uuid,
    flagged_at timestamp with time zone,
    is_spam boolean DEFAULT false,
    spam_score integer DEFAULT 0,
    moderation_status text DEFAULT 'approved',
    moderated_by uuid,
    moderated_at timestamp with time zone,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    is_like BOOLEAN NOT NULL DEFAULT true, -- true for like, false for dislike
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50),
    user_ip VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

-- Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

-- Create series_followers table
CREATE TABLE IF NOT EXISTS series_followers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    series_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, series_id)
);

-- Create download_links table
CREATE TABLE IF NOT EXISTS download_links (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    episode_id BIGINT REFERENCES episodes(id) ON DELETE CASCADE,
    quality VARCHAR(20) NOT NULL,
    format VARCHAR(20) DEFAULT 'MP4',
    link_url TEXT NOT NULL,
    provider VARCHAR(100),
    file_size VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    uploaded_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_download_link UNIQUE(movie_id, episode_id, quality, provider)
);

-- ============================================================================
-- BLOG & PAGES
-- ============================================================================

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500),
    slug VARCHAR(500) UNIQUE,
    body TEXT,
    featured_image_url TEXT,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create custom_pages table
CREATE TABLE IF NOT EXISTS custom_pages (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500),
    slug VARCHAR(500) UNIQUE,
    content TEXT,
    featured_image_url TEXT,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SETTINGS & CONFIGURATION
-- ============================================================================

-- Create advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
    id BIGSERIAL PRIMARY KEY,
    position VARCHAR(50),
    content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
    id BIGSERIAL PRIMARY KEY,
    site_title VARCHAR(255),
    site_description TEXT,
    site_logo_url TEXT,
    site_favicon_url TEXT,
    footer_text TEXT,
    header_custom_code TEXT,
    footer_custom_code TEXT,
    watch_page_custom_html TEXT,
    watch_page_middle_custom_html TEXT,
    meta_home_title TEXT,
    meta_movies_list_title TEXT,
    meta_series_list_title TEXT,
    meta_movie_detail_title TEXT,
    meta_series_detail_title TEXT,
    meta_movie_watch_title TEXT,
    meta_series_watch_title TEXT,
    meta_blog_list_title TEXT,
    meta_blog_post_title TEXT,
    meta_page_title TEXT,
    theme_color TEXT,
    header_menu JSONB,
    footer_links JSONB,
    social_links JSONB,
    quick_links JSONB,
    cache_enabled BOOLEAN DEFAULT false,
    enable_cache BOOLEAN DEFAULT false,
    cache_ttl_movies INTEGER,
    cache_ttl_trending INTEGER,
    cache_ttl_genres INTEGER,
    cache_ttl_minutes INTEGER,
    enable_image_optimization BOOLEAN DEFAULT false,
    compress_images BOOLEAN DEFAULT false,
    max_movies_per_page INTEGER,
    max_items_per_page INTEGER,
    enable_lazy_loading BOOLEAN DEFAULT false,
    database_query_timeout INTEGER,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_password TEXT,
    email_from TEXT,
    smtp_secure BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create players table (for embed player settings)
CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SOCIAL COMMUNITY TABLES
-- ============================================================================

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    youtube_url TEXT,
    image_url TEXT,
    parent_post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    reply_to_post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    repost_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_likes table
CREATE TABLE IF NOT EXISTS post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Create post_comments table
CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    parent_comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_reposts table
CREATE TABLE IF NOT EXISTS post_reposts (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    quote_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Create hashtags table (must be created before post_hashtags)
CREATE TABLE IF NOT EXISTS hashtags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_hashtags table (after hashtags table)
CREATE TABLE IF NOT EXISTS post_hashtags (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id BIGINT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, hashtag_id)
);

-- Create post_movies table
CREATE TABLE IF NOT EXISTS post_movies (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, movie_id)
);

-- Create user_follows table
CREATE TABLE IF NOT EXISTS user_follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id UUID NOT NULL,
    following_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- ============================================================================
-- MESSAGING TABLES (Placeholder - may not be fully implemented)
-- ============================================================================

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation_participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATION TABLES
-- ============================================================================

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    email_new_episodes BOOLEAN DEFAULT true,
    email_comment_replies BOOLEAN DEFAULT true,
    email_weekly_digest BOOLEAN DEFAULT true,
    email_new_favorites BOOLEAN DEFAULT false,
    email_marketing BOOLEAN DEFAULT false,
    digest_frequency VARCHAR(50) DEFAULT 'weekly',
    last_digest_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create email_notifications_log table
CREATE TABLE IF NOT EXISTS email_notifications_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    email_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    content_preview TEXT,
    movie_id BIGINT REFERENCES movies(id) ON DELETE SET NULL,
    episode_id BIGINT REFERENCES episodes(id) ON DELETE SET NULL,
    comment_id BIGINT REFERENCES comments(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'sent',
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create talkflix_notifications table
CREATE TABLE IF NOT EXISTS talkflix_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
    content TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MODERATION TABLES
-- ============================================================================

-- Create moderation_logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone DEFAULT now(),
    moderator_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    reason text,
    details jsonb
);

-- Create spam_patterns table
CREATE TABLE IF NOT EXISTS spam_patterns (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone DEFAULT now(),
    pattern text NOT NULL,
    pattern_type text NOT NULL,
    severity integer DEFAULT 1,
    is_active boolean DEFAULT true
);

-- Create user_reports table
CREATE TABLE IF NOT EXISTS user_reports (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone DEFAULT now(),
    reporter_id uuid,
    reported_user_id uuid,
    comment_id bigint REFERENCES comments(id),
    reason text NOT NULL,
    report_type text NOT NULL,
    status text DEFAULT 'pending',
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    resolution_notes text
);

-- ============================================================================
-- ANALYTICS TABLES
-- ============================================================================

-- Create view_analytics table
CREATE TABLE IF NOT EXISTS view_analytics (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    view_duration INTEGER,
    completion_percentage INTEGER,
    device_type TEXT,
    browser TEXT,
    country TEXT,
    referrer TEXT,
    player_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search_analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    results_count INTEGER,
    clicked_result_id BIGINT REFERENCES movies(id) ON DELETE SET NULL,
    device_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_errors table
CREATE TABLE IF NOT EXISTS player_errors (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    player_used TEXT,
    error_type TEXT,
    error_message TEXT,
    device_type TEXT,
    browser TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_stats table
CREATE TABLE IF NOT EXISTS daily_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_views INTEGER DEFAULT 0,
    total_searches INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255),
    endpoint VARCHAR(255),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Movies indexes
CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type);
CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_views ON movies(views DESC);
CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_movies_imdb_id ON movies(imdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);

-- Seasons and episodes indexes
CREATE INDEX IF NOT EXISTS idx_seasons_movie_id ON seasons(movie_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);

-- Junction table indexes
CREATE INDEX IF NOT EXISTS idx_movie_genres_movie_id ON movie_genres(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_id ON movie_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_movie_id ON movie_countries(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_country_id ON movie_countries(country_id);
CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_id ON movie_actors(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_actors_actor_id ON movie_actors(actor_id);
CREATE INDEX IF NOT EXISTS idx_movie_tags_movie_id ON movie_tags(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_tags_tag_id ON movie_tags(tag_id);

-- Tags and hashtags indexes
CREATE INDEX IF NOT EXISTS tags_name_idx ON tags(name);
CREATE INDEX IF NOT EXISTS tags_slug_idx ON tags(slug);
CREATE INDEX IF NOT EXISTS hashtags_name_idx ON hashtags(name);
CREATE INDEX IF NOT EXISTS hashtags_post_count_idx ON hashtags(post_count DESC);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_movie_id ON comments(movie_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_flagged ON comments(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_comments_spam ON comments(is_spam) WHERE is_spam = true;
CREATE INDEX IF NOT EXISTS idx_comments_moderation_status ON comments(moderation_status);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON profiles(reputation_score);
CREATE INDEX IF NOT EXISTS idx_profiles_muted ON profiles(is_muted) WHERE is_muted = true;

-- Posts indexes
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_id_idx ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS post_reposts_post_id_idx ON post_reposts(post_id);
CREATE INDEX IF NOT EXISTS post_reposts_user_id_idx ON post_reposts(user_id);
CREATE INDEX IF NOT EXISTS post_hashtags_post_id_idx ON post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS post_hashtags_hashtag_id_idx ON post_hashtags(hashtag_id);
CREATE INDEX IF NOT EXISTS post_movies_post_id_idx ON post_movies(post_id);
CREATE INDEX IF NOT EXISTS post_movies_movie_id_idx ON post_movies(movie_id);
CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS user_follows_following_id_idx ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id ON bookmarks(post_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_log_user_id ON email_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_talkflix_notifications_user_id ON talkflix_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_talkflix_notifications_read ON talkflix_notifications(user_id, read);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_view_analytics_movie ON view_analytics(movie_id);
CREATE INDEX IF NOT EXISTS idx_view_analytics_user ON view_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_view_analytics_created ON view_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_player_errors_movie ON player_errors(movie_id);
CREATE INDEX IF NOT EXISTS idx_player_errors_created ON player_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- Moderation indexes
CREATE INDEX IF NOT EXISTS idx_moderation_logs_target ON moderation_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON custom_pages(slug);
CREATE INDEX IF NOT EXISTS idx_download_links_movie ON download_links(movie_id);
CREATE INDEX IF NOT EXISTS idx_download_links_episode ON download_links(episode_id);
CREATE INDEX IF NOT EXISTS idx_series_followers_user_id ON series_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_series_followers_series_id ON series_followers(series_id);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default site settings if not exists
INSERT INTO site_settings (site_title, site_description)
SELECT 'RockFlix', 'Your favorite movies and TV shows'
WHERE NOT EXISTS (SELECT 1 FROM site_settings LIMIT 1);

-- Insert default spam patterns
INSERT INTO spam_patterns (pattern, pattern_type, severity, is_active) VALUES
('viagra', 'keyword', 8, true),
('cialis', 'keyword', 8, true),
('casino', 'keyword', 7, true),
('lottery', 'keyword', 6, true),
('click here', 'keyword', 5, true),
('buy now', 'keyword', 5, true),
('limited offer', 'keyword', 4, true),
('act now', 'keyword', 4, true),
('http://', 'url', 3, true),
('https://', 'url', 2, true),
('bit.ly', 'url', 6, true),
('tinyurl', 'url', 6, true)
ON CONFLICT DO NOTHING;

