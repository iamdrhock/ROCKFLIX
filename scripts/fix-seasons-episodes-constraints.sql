-- Fix missing unique constraints on seasons and episodes tables
-- Run this in Contabo PostgreSQL via Adminer or psql

-- Add unique constraint to seasons table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'seasons_movie_id_season_number_key'
    ) THEN
        ALTER TABLE seasons 
        ADD CONSTRAINT seasons_movie_id_season_number_key 
        UNIQUE (movie_id, season_number);
        RAISE NOTICE 'Added unique constraint to seasons table';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on seasons table';
    END IF;
END $$;

-- Add unique constraint to episodes table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'episodes_season_id_episode_number_key'
    ) THEN
        ALTER TABLE episodes 
        ADD CONSTRAINT episodes_season_id_episode_number_key 
        UNIQUE (season_id, episode_number);
        RAISE NOTICE 'Added unique constraint to episodes table';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on episodes table';
    END IF;
END $$;

-- Alternative simpler version (if DO blocks don't work):
-- ALTER TABLE seasons ADD CONSTRAINT seasons_movie_id_season_number_key UNIQUE (movie_id, season_number);
-- ALTER TABLE episodes ADD CONSTRAINT episodes_season_id_episode_number_key UNIQUE (season_id, episode_number);

