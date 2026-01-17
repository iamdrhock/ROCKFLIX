-- Add theme_color field to site_settings table
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'green';

-- Set default theme color if not exists
UPDATE site_settings
SET theme_color = 'green'
WHERE id = 1 AND theme_color IS NULL;

COMMENT ON COLUMN site_settings.theme_color IS 'Site theme color: green, red, blue, or gold';
