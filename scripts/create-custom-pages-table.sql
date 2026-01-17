-- Create custom_pages table for static pages like About, Contact, Privacy, etc.
CREATE TABLE IF NOT EXISTS custom_pages (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  featured_image_url TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON custom_pages(slug);

-- Create index on published status
CREATE INDEX IF NOT EXISTS idx_custom_pages_published ON custom_pages(published);

-- Add some sample pages
INSERT INTO custom_pages (title, slug, content, published) VALUES
  ('About Us', 'about', 'Welcome to our streaming platform. We provide the best movies and TV shows for your entertainment.', true),
  ('Contact', 'contact', 'Get in touch with us for any questions or concerns.', true),
  ('Privacy Policy', 'privacy', 'Your privacy is important to us. This policy outlines how we handle your data.', true),
  ('Terms of Service', 'terms', 'By using our service, you agree to these terms and conditions.', true)
ON CONFLICT (slug) DO NOTHING;
