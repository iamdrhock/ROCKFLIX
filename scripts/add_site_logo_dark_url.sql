-- Add site_logo_dark_url column to site_settings table
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS site_logo_dark_url TEXT;

COMMENT ON COLUMN site_settings.site_logo_dark_url IS 'Dark theme site logo URL';


