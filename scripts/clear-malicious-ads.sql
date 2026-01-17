-- SECURITY FIX: Clear malicious ad content from database
-- Run this script to remove any potentially malicious ad content

-- Clear all advertisements that contain suspicious patterns
UPDATE advertisements 
SET 
  content = '',
  is_active = false,
  updated_at = NOW()
WHERE 
  -- Block scripts
  content ILIKE '%<script%' OR
  content ILIKE '%javascript:%' OR
  content ILIKE '%onerror=%' OR
  content ILIKE '%onload=%' OR
  content ILIKE '%onclick=%' OR
  content ILIKE '%eval(%' OR
  content ILIKE '%document.write%' OR
  content ILIKE '%window.open%' OR
  -- Block iframes from unknown sources
  (content ILIKE '%<iframe%' AND content NOT ILIKE '%player.vidify.top%' AND content NOT ILIKE '%player.vidplus.to%' AND content NOT ILIKE '%vidsrc-embed.ru%' AND content NOT ILIKE '%vidlink.pro%' AND content NOT ILIKE '%mapple.uk%' AND content NOT ILIKE '%primesrc.me%' AND content NOT ILIKE '%multiembed.mov%' AND content NOT ILIKE '%player.autoembed.cc%' AND content NOT ILIKE '%player.videasy.net%') OR
  -- Block suspicious domains
  content ILIKE '%popup%' OR
  content ILIKE '%pop-up%' OR
  content ILIKE '%adclick%' OR
  content ILIKE '%doubleclick%' OR
  content ILIKE '%googlesyndication%' OR
  content ILIKE '%adservice%';

-- Log what was cleared
SELECT 
  position,
  CASE 
    WHEN content = '' THEN 'CLEARED - Suspicious content detected'
    ELSE 'ACTIVE - Safe content'
  END as status,
  updated_at
FROM advertisements
ORDER BY updated_at DESC;

