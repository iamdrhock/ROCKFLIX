-- Add country column to movies table
ALTER TABLE movies
ADD COLUMN IF NOT EXISTS country VARCHAR(255);

-- Add an index for better query performance when filtering by country
CREATE INDEX IF NOT EXISTS idx_movies_country ON movies(country);

-- Update existing movies with default country (optional - you can remove this if you want to set countries manually)
-- UPDATE movies SET country = 'United States' WHERE country IS NULL;

COMMENT ON COLUMN movies.country IS 'Country of origin for the movie or series';
