-- Add SEO meta fields to site_settings table
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS meta_home_title TEXT DEFAULT '{site_name} - Watch/Download Movies & TV Shows HD Free',
ADD COLUMN IF NOT EXISTS meta_movies_list_title TEXT DEFAULT 'Movies - Watch/Download Full Movies HD Free | {site_name}',
ADD COLUMN IF NOT EXISTS meta_series_list_title TEXT DEFAULT 'TV Shows - Watch/Download Full Seasons HD Free | {site_name}',
ADD COLUMN IF NOT EXISTS meta_blog_list_title TEXT DEFAULT 'Blog - Latest News & Updates | {site_name}',
ADD COLUMN IF NOT EXISTS meta_movie_detail_title TEXT DEFAULT '{title} | Watch/Download Full Movie HD Free - {site_name}',
ADD COLUMN IF NOT EXISTS meta_series_detail_title TEXT DEFAULT '{title} | Watch/Download Full Seasons HD Free - {site_name}',
ADD COLUMN IF NOT EXISTS meta_blog_post_title TEXT DEFAULT '{title} - {site_name}',
ADD COLUMN IF NOT EXISTS meta_page_title TEXT DEFAULT '{title} - {site_name}';

-- Update existing row with default values if they don't exist
UPDATE site_settings
SET 
  meta_home_title = COALESCE(meta_home_title, '{site_name} - Watch/Download Movies & TV Shows HD Free'),
  meta_movies_list_title = COALESCE(meta_movies_list_title, 'Movies - Watch/Download Full Movies HD Free | {site_name}'),
  meta_series_list_title = COALESCE(meta_series_list_title, 'TV Shows - Watch/Download Full Seasons HD Free | {site_name}'),
  meta_blog_list_title = COALESCE(meta_blog_list_title, 'Blog - Latest News & Updates | {site_name}'),
  meta_movie_detail_title = COALESCE(meta_movie_detail_title, '{title} | Watch/Download Full Movie HD Free - {site_name}'),
  meta_series_detail_title = COALESCE(meta_series_detail_title, '{title} | Watch/Download Full Seasons HD Free - {site_name}'),
  meta_blog_post_title = COALESCE(meta_blog_post_title, '{title} - {site_name}'),
  meta_page_title = COALESCE(meta_page_title, '{title} - {site_name}')
WHERE id = 1;
