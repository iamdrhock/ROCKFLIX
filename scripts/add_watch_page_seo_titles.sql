-- Add watch page SEO title fields to site_settings table
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS meta_movie_watch_title TEXT DEFAULT 'Watch {title} Online Free HD - {site_name}',
ADD COLUMN IF NOT EXISTS meta_series_watch_title TEXT DEFAULT 'Watch {title} Online Free HD - {site_name}';

-- Update existing row with default values if they don't exist
UPDATE site_settings
SET 
  meta_movie_watch_title = COALESCE(meta_movie_watch_title, 'Watch {title} Online Free HD - {site_name}'),
  meta_series_watch_title = COALESCE(meta_series_watch_title, 'Watch {title} Online Free HD - {site_name}')
WHERE id = 1;
