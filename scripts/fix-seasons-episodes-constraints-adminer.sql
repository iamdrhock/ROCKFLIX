-- Fix missing unique constraints on seasons and episodes tables
-- Copy and paste this into Adminer SQL command box

-- Add unique constraint to seasons table
ALTER TABLE seasons 
ADD CONSTRAINT seasons_movie_id_season_number_key 
UNIQUE (movie_id, season_number);

-- Add unique constraint to episodes table
ALTER TABLE episodes 
ADD CONSTRAINT episodes_season_id_episode_number_key 
UNIQUE (season_id, episode_number);

