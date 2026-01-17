-- Add optimization settings columns to site_settings
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS cache_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cache_ttl_movies INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS cache_ttl_trending INTEGER DEFAULT 180,
ADD COLUMN IF NOT EXISTS cache_ttl_genres INTEGER DEFAULT 600,
ADD COLUMN IF NOT EXISTS max_items_per_page INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS enable_lazy_loading BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS compress_images BOOLEAN DEFAULT true;

-- Set default values for existing row
UPDATE site_settings
SET 
  cache_enabled = COALESCE(cache_enabled, true),
  cache_ttl_movies = COALESCE(cache_ttl_movies, 300),
  cache_ttl_trending = COALESCE(cache_ttl_trending, 180),
  cache_ttl_genres = COALESCE(cache_ttl_genres, 600),
  max_items_per_page = COALESCE(max_items_per_page, 24),
  enable_lazy_loading = COALESCE(enable_lazy_loading, true),
  compress_images = COALESCE(compress_images, true);
