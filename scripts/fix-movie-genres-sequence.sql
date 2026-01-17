-- Fix movie_genres sequence if it's out of sync
-- This fixes "duplicate key value violates unique constraint movie_genres_pkey" errors

-- Reset the sequence to the maximum id + 1
SELECT setval('movie_genres_id_seq', COALESCE((SELECT MAX(id) FROM movie_genres), 0) + 1, false);

-- Verify the sequence is correct
SELECT currval('movie_genres_id_seq') as current_sequence_value;
SELECT MAX(id) as max_id_in_table FROM movie_genres;

