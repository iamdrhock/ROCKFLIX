-- Add custom code fields to site_settings table
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS header_custom_code TEXT,
ADD COLUMN IF NOT EXISTS footer_custom_code TEXT;

-- Add comments for documentation
COMMENT ON COLUMN site_settings.header_custom_code IS 'Custom HTML/JavaScript code to be injected in the site header';
COMMENT ON COLUMN site_settings.footer_custom_code IS 'Custom HTML/JavaScript code to be injected in the site footer';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'site_settings' 
AND column_name IN ('header_custom_code', 'footer_custom_code');
