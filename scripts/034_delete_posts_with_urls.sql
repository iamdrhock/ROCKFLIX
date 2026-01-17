-- Delete posts that contain URLs/links
-- This will help fix the crash caused by posts with links

DELETE FROM posts
WHERE content ~* 'https?://|www\.|\.com|\.net|\.org|\.io|\.co|\.uk|\.app|\.dev|\.vercel\.app';

-- Also delete any posts with common URL patterns
DELETE FROM posts
WHERE content LIKE '%http://%'
   OR content LIKE '%https://%'
   OR content LIKE '%www.%';
