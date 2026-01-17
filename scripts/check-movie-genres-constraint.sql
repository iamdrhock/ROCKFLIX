-- Check if unique constraint exists on movie_genres
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'movie_genres'
    AND nsp.nspname = 'public'
    AND con.contype = 'u';

-- If no constraint exists, add it:
-- ALTER TABLE movie_genres
-- ADD CONSTRAINT movie_genres_movie_id_genre_id_key UNIQUE (movie_id, genre_id);

