-- Verify Database Migration
-- Run this in Adminer SQL command section after migration
-- Compare results with DigitalOcean database

-- 1. Check Table Counts
SELECT 
  'movies' as table_name, 
  COUNT(*) as count,
  MAX(id) as max_id,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM movies
UNION ALL
SELECT 'genres', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM genres
UNION ALL
SELECT 'actors', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM actors
UNION ALL
SELECT 'seasons', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM seasons
UNION ALL
SELECT 'episodes', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM episodes
UNION ALL
SELECT 'profiles', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM profiles
UNION ALL
SELECT 'comments', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM comments
UNION ALL
SELECT 'posts', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM posts
UNION ALL
SELECT 'blog_posts', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM blog_posts
UNION ALL
SELECT 'custom_pages', COUNT(*), MAX(id), MIN(created_at), MAX(created_at) FROM custom_pages
ORDER BY table_name;

-- 2. Check Foreign Key Integrity
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- 3. Check Sequences (Auto-increment IDs)
SELECT 
  schemaname,
  sequencename,
  last_value,
  is_called
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- 4. Check for Orphaned Records
-- Movies without genres
SELECT COUNT(*) as movies_without_genres
FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
WHERE mg.movie_id IS NULL;

-- Movies without actors
SELECT COUNT(*) as movies_without_actors
FROM movies m
LEFT JOIN movie_actors ma ON m.id = ma.movie_id
WHERE ma.movie_id IS NULL;

-- Episodes without seasons
SELECT COUNT(*) as episodes_without_seasons
FROM episodes e
LEFT JOIN seasons s ON e.season_id = s.id
WHERE s.id IS NULL;

-- Comments without movies
SELECT COUNT(*) as comments_without_movies
FROM comments c
LEFT JOIN movies m ON c.movie_id = m.id
WHERE m.id IS NULL AND c.movie_id IS NOT NULL;

-- 5. Check Indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. Check Table Sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 7. Check Recent Activity
SELECT 
  'movies' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
FROM movies
UNION ALL
SELECT 'comments', COUNT(*), 
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END),
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END)
FROM comments
UNION ALL
SELECT 'posts', COUNT(*),
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END),
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END)
FROM posts;

-- 8. Check Data Quality
-- Movies with missing required fields
SELECT COUNT(*) as movies_missing_title
FROM movies
WHERE title IS NULL OR title = '';

SELECT COUNT(*) as movies_missing_poster
FROM movies
WHERE poster_url IS NULL OR poster_url = '';

-- 9. Check Relationships
-- Movie genres count
SELECT 
  m.id,
  m.title,
  COUNT(mg.genre_id) as genre_count
FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
GROUP BY m.id, m.title
HAVING COUNT(mg.genre_id) = 0
LIMIT 10;

-- Movie actors count
SELECT 
  m.id,
  m.title,
  COUNT(ma.actor_id) as actor_count
FROM movies m
LEFT JOIN movie_actors ma ON m.id = ma.movie_id
GROUP BY m.id, m.title
HAVING COUNT(ma.actor_id) = 0
LIMIT 10;

-- 10. Verify Site Settings
SELECT * FROM site_settings;

-- 11. Check Admin Users
SELECT 
  id,
  username,
  email,
  created_at,
  last_login
FROM admin_users;

-- 12. Check Database Version and Info
SELECT version();
SELECT current_database();
SELECT current_user;

