-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id BIGSERIAL PRIMARY KEY,
  site_title VARCHAR(255) DEFAULT 'M4UHDTV',
  site_description TEXT DEFAULT 'Stream the latest movies and TV shows in HD quality',
  site_logo_url TEXT,
  site_favicon_url TEXT,
  header_menu JSONB DEFAULT '[
    {"label": "Home", "url": "/"},
    {"label": "Movies", "url": "/movies"},
    {"label": "TV Shows", "url": "/series"},
    {"label": "Genres", "url": "/genres"}
  ]'::jsonb,
  footer_links JSONB DEFAULT '[
    {"label": "DMCA", "url": "/dmca"},
    {"label": "FAQs", "url": "/faqs"},
    {"label": "Contact", "url": "/contact"},
    {"label": "Sitemap", "url": "/sitemap"}
  ]'::jsonb,
  social_links JSONB DEFAULT '[
    {"platform": "facebook", "url": "#"},
    {"platform": "twitter", "url": "#"},
    {"platform": "instagram", "url": "#"},
    {"platform": "youtube", "url": "#"}
  ]'::jsonb,
  footer_text TEXT DEFAULT 'YOUR FAVORITE MOVIES ON M4UHDTV',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO site_settings (id, site_title, site_description, footer_text)
VALUES (1, 'M4UHDTV', 'Stream the latest movies and TV shows in HD quality. Watch trending content, discover new releases, and enjoy unlimited entertainment.', 'YOUR FAVORITE MOVIES ON M4UHDTV')
ON CONFLICT (id) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_site_settings_id ON site_settings(id);
