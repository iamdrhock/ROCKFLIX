-- Create download_links table for managing movie and episode download links
CREATE TABLE IF NOT EXISTS download_links (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  episode_id BIGINT REFERENCES episodes(id) ON DELETE CASCADE,
  quality VARCHAR(20) NOT NULL, -- '480p', '720p', '1080p', '4K', etc.
  format VARCHAR(20) DEFAULT 'MP4', -- 'MP4', 'MKV', 'AVI', etc.
  link_url TEXT NOT NULL,
  provider VARCHAR(100), -- 'Google Drive', 'Mega', 'Dropbox', etc.
  file_size VARCHAR(50), -- '500MB', '2GB', '1.5GB', etc.
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'broken'
  uploaded_by VARCHAR(100), -- admin who added this
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_download_link UNIQUE(movie_id, episode_id, quality, provider)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_download_links_movie ON download_links(movie_id);
CREATE INDEX IF NOT EXISTS idx_download_links_episode ON download_links(episode_id);
CREATE INDEX IF NOT EXISTS idx_download_links_status ON download_links(status);

-- Enable Row Level Security
ALTER TABLE download_links ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to active download links" 
  ON download_links FOR SELECT 
  USING (status = 'active');

-- Create policies for service role full access
CREATE POLICY "Allow service role full access to download links" 
  ON download_links FOR ALL 
  USING (true);

-- Add comment to table
COMMENT ON TABLE download_links IS 'Stores download links for movies and TV series episodes';
