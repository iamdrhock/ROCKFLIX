-- Add watch_page_custom_html field to site_settings table
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS watch_page_custom_html TEXT DEFAULT '';

-- Add comment to describe the field
COMMENT ON COLUMN site_settings.watch_page_custom_html IS 'Custom HTML/text content displayed on watch page between player selection and ad box';
