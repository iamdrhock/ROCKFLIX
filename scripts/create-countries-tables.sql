-- Create countries table (similar to genres)
CREATE TABLE IF NOT EXISTS countries (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create movie_countries junction table (similar to movie_genres)
CREATE TABLE IF NOT EXISTS movie_countries (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  country_id BIGINT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  UNIQUE(movie_id, country_id)
);

-- Enable RLS on countries table
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- Create policies for countries table
CREATE POLICY "Allow public read access" ON countries
  FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON countries
  FOR ALL USING (true);

-- Enable RLS on movie_countries table
ALTER TABLE movie_countries ENABLE ROW LEVEL SECURITY;

-- Create policies for movie_countries table
CREATE POLICY "Allow public read access" ON movie_countries
  FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON movie_countries
  FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_movie_countries_movie_id ON movie_countries(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_country_id ON movie_countries(country_id);
CREATE INDEX IF NOT EXISTS idx_countries_name ON countries(name);
