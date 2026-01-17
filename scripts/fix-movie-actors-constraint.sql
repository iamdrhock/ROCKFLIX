-- Add unique constraint to movie_actors table
-- This fixes the "ON CONFLICT" error when importing actors

-- First, remove any duplicate entries (keep the first one)
DELETE FROM movie_actors a
WHERE a.id NOT IN (
    SELECT MIN(id)
    FROM movie_actors
    GROUP BY movie_id, actor_id
);

-- Add unique constraint
ALTER TABLE movie_actors
ADD CONSTRAINT movie_actors_movie_id_actor_id_key UNIQUE (movie_id, actor_id);

-- Also add index for better performance
CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_id ON movie_actors(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_actors_actor_id ON movie_actors(actor_id);

