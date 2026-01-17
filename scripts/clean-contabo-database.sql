-- Clean Contabo Database - Drop All Tables and Data
-- WARNING: This will delete ALL data from your Contabo database!
-- Run this ONLY if you want to start fresh
-- Run this BEFORE importing schema and data

-- Disable foreign key checks (PostgreSQL doesn't have this, so we'll drop in correct order)

-- Drop all tables in correct order (respecting foreign key dependencies)

-- Drop dependent tables first
DROP TABLE IF EXISTS post_hashtags CASCADE;
DROP TABLE IF EXISTS post_movies CASCADE;
DROP TABLE IF EXISTS post_reposts CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS hashtags CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_follows CASCADE;
DROP TABLE IF EXISTS email_notifications_log CASCADE;
DROP TABLE IF EXISTS talkflix_notifications CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;
DROP TABLE IF EXISTS moderation_logs CASCADE;
DROP TABLE IF EXISTS spam_patterns CASCADE;
DROP TABLE IF EXISTS view_analytics CASCADE;
DROP TABLE IF EXISTS search_analytics CASCADE;
DROP TABLE IF EXISTS player_errors CASCADE;
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS comment_likes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS series_followers CASCADE;
DROP TABLE IF EXISTS download_links CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS movie_tags CASCADE;
DROP TABLE IF EXISTS movie_actors CASCADE;
DROP TABLE IF EXISTS movie_countries CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS actors CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS admin_sessions CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS custom_pages CASCADE;
DROP TABLE IF EXISTS advertisements CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop sequences if they exist (some might be left over)
DROP SEQUENCE IF EXISTS actors_id_seq CASCADE;
DROP SEQUENCE IF EXISTS genres_id_seq CASCADE;
DROP SEQUENCE IF EXISTS countries_id_seq CASCADE;
DROP SEQUENCE IF EXISTS tags_id_seq CASCADE;
DROP SEQUENCE IF EXISTS movies_id_seq CASCADE;
DROP SEQUENCE IF EXISTS seasons_id_seq CASCADE;
DROP SEQUENCE IF EXISTS episodes_id_seq CASCADE;
DROP SEQUENCE IF EXISTS profiles_id_seq CASCADE;
DROP SEQUENCE IF EXISTS admin_users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS admin_sessions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS comments_id_seq CASCADE;
DROP SEQUENCE IF EXISTS favorites_id_seq CASCADE;
DROP SEQUENCE IF EXISTS watchlist_id_seq CASCADE;
DROP SEQUENCE IF EXISTS download_links_id_seq CASCADE;
DROP SEQUENCE IF EXISTS blog_posts_id_seq CASCADE;
DROP SEQUENCE IF EXISTS custom_pages_id_seq CASCADE;
DROP SEQUENCE IF EXISTS advertisements_id_seq CASCADE;
DROP SEQUENCE IF EXISTS site_settings_id_seq CASCADE;
DROP SEQUENCE IF EXISTS players_id_seq CASCADE;
DROP SEQUENCE IF EXISTS posts_id_seq CASCADE;
DROP SEQUENCE IF EXISTS hashtags_id_seq CASCADE;
DROP SEQUENCE IF EXISTS bookmarks_id_seq CASCADE;
DROP SEQUENCE IF EXISTS conversations_id_seq CASCADE;
DROP SEQUENCE IF EXISTS messages_id_seq CASCADE;
DROP SEQUENCE IF EXISTS user_follows_id_seq CASCADE;
DROP SEQUENCE IF EXISTS notification_preferences_id_seq CASCADE;
DROP SEQUENCE IF EXISTS talkflix_notifications_id_seq CASCADE;
DROP SEQUENCE IF EXISTS user_reports_id_seq CASCADE;
DROP SEQUENCE IF EXISTS moderation_logs_id_seq CASCADE;
DROP SEQUENCE IF EXISTS spam_patterns_id_seq CASCADE;
DROP SEQUENCE IF EXISTS view_analytics_id_seq CASCADE;
DROP SEQUENCE IF EXISTS search_analytics_id_seq CASCADE;
DROP SEQUENCE IF EXISTS player_errors_id_seq CASCADE;
DROP SEQUENCE IF EXISTS daily_stats_id_seq CASCADE;
DROP SEQUENCE IF EXISTS rate_limits_id_seq CASCADE;

-- Verify cleanup (should return 0 rows)
SELECT COUNT(*) as remaining_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- If the above returns 0, you're ready to run the schema script!
-- Next step: Run scripts/contabo-complete-schema.sql

