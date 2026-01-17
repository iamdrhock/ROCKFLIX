-- Fix missing unique constraints on seasons and episodes tables
-- Run this in Contabo PostgreSQL via Adminer
-- This version checks if constraints exist first, then adds them

-- First, check and drop existing constraints if they exist (to avoid conflicts)
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_movie_id_season_number_key;
ALTER TABLE episodes DROP CONSTRAINT IF EXISTS episodes_season_id_episode_number_key;

-- Now add the unique constraints
ALTER TABLE seasons 
ADD CONSTRAINT seasons_movie_id_season_number_key 
UNIQUE (movie_id, season_number);

ALTER TABLE episodes 
ADD CONSTRAINT episodes_season_id_episode_number_key 
UNIQUE (season_id, episode_number);

