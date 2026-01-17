-- Export All Data from DigitalOcean PostgreSQL
-- Run this in Adminer SQL command section
-- This will generate COPY commands for all tables

-- Export Genres
COPY (SELECT * FROM genres ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Countries
COPY (SELECT * FROM countries ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Tags
COPY (SELECT * FROM tags ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Actors
COPY (SELECT * FROM actors ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Movies
COPY (SELECT * FROM movies ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Seasons
COPY (SELECT * FROM seasons ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Episodes
COPY (SELECT * FROM episodes ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Movie Genres (Junction Table)
COPY (SELECT * FROM movie_genres ORDER BY movie_id, genre_id) TO STDOUT WITH CSV HEADER;

-- Export Movie Countries (Junction Table)
COPY (SELECT * FROM movie_countries ORDER BY movie_id, country_id) TO STDOUT WITH CSV HEADER;

-- Export Movie Actors (Junction Table)
COPY (SELECT * FROM movie_actors ORDER BY movie_id, actor_id) TO STDOUT WITH CSV HEADER;

-- Export Movie Tags (Junction Table)
COPY (SELECT * FROM movie_tags ORDER BY movie_id, tag_id) TO STDOUT WITH CSV HEADER;

-- Export Admin Users
COPY (SELECT * FROM admin_users ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Admin Sessions
COPY (SELECT * FROM admin_sessions ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Profiles
COPY (SELECT * FROM profiles ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Comments
COPY (SELECT * FROM comments ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Comment Likes
COPY (SELECT * FROM comment_likes ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Favorites
COPY (SELECT * FROM favorites ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Watchlist
COPY (SELECT * FROM watchlist ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Series Followers
COPY (SELECT * FROM series_followers ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Reactions
COPY (SELECT * FROM reactions ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Download Links
COPY (SELECT * FROM download_links ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Blog Posts
COPY (SELECT * FROM blog_posts ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Custom Pages
COPY (SELECT * FROM custom_pages ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Advertisements
COPY (SELECT * FROM advertisements ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Site Settings
COPY (SELECT * FROM site_settings ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Players
COPY (SELECT * FROM players ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Posts (TalkFlix)
COPY (SELECT * FROM posts ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Post Likes
COPY (SELECT * FROM post_likes ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Post Comments
COPY (SELECT * FROM post_comments ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Post Reposts
COPY (SELECT * FROM post_reposts ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Post Hashtags
COPY (SELECT * FROM post_hashtags ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Post Movies
COPY (SELECT * FROM post_movies ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Hashtags
COPY (SELECT * FROM hashtags ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Bookmarks
COPY (SELECT * FROM bookmarks ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export User Follows
COPY (SELECT * FROM user_follows ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Conversations
COPY (SELECT * FROM conversations ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Conversation Participants
COPY (SELECT * FROM conversation_participants ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Messages
COPY (SELECT * FROM messages ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Notification Preferences
COPY (SELECT * FROM notification_preferences ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Email Notifications Log
COPY (SELECT * FROM email_notifications_log ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export TalkFlix Notifications
COPY (SELECT * FROM talkflix_notifications ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export User Reports
COPY (SELECT * FROM user_reports ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Moderation Logs
COPY (SELECT * FROM moderation_logs ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Spam Patterns
COPY (SELECT * FROM spam_patterns ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export View Analytics
COPY (SELECT * FROM view_analytics ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Search Analytics
COPY (SELECT * FROM search_analytics ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Player Errors
COPY (SELECT * FROM player_errors ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Daily Stats
COPY (SELECT * FROM daily_stats ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Export Rate Limits
COPY (SELECT * FROM rate_limits ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Note: To export to files, you'll need to use pg_dump or Adminer's export feature
-- Adminer doesn't support COPY TO STDOUT directly, so use the Export feature instead

