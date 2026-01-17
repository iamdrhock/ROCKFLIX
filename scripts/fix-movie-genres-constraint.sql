-- Add unique constraint to movie_genres table
-- This ensures ON CONFLICT works correctly when importing genres

-- First, remove any duplicate entries (keep the first one)
DELETE FROM movie_genres a
WHERE a.id NOT IN (
    SELECT MIN(id)
    FROM movie_genres
    GROUP BY movie_id, genre_id
);

-- Add unique constraint
ALTER TABLE movie_genres
ADD CONSTRAINT movie_genres_movie_id_genre_id_key UNIQUE (movie_id, genre_id);

-- Also add index for better performance
CREATE INDEX IF NOT EXISTS idx_movie_genres_movie_id ON movie_genres(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_id ON movie_genres(genre_id);

