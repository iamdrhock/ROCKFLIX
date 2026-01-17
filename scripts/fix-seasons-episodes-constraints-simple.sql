-- Fix missing unique constraints on seasons and episodes tables (Simple version)
-- Run this in Contabo PostgreSQL via Adminer or psql

-- Add unique constraint to seasons table
ALTER TABLE seasons 
ADD CONSTRAINT IF NOT EXISTS seasons_movie_id_season_number_key 
UNIQUE (movie_id, season_number);

-- Add unique constraint to episodes table
ALTER TABLE episodes 
ADD CONSTRAINT IF NOT EXISTS episodes_season_id_episode_number_key 
UNIQUE (season_id, episode_number);

