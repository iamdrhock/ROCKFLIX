-- Add trailer_url column to movies table if it doesn't exist
-- Run this in Adminer or your PostgreSQL client

-- For Contabo/PostgreSQL
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'movies' 
        AND column_name = 'trailer_url'
    ) THEN
        ALTER TABLE movies ADD COLUMN trailer_url TEXT;
        RAISE NOTICE 'Column trailer_url added to movies table';
    ELSE
        RAISE NOTICE 'Column trailer_url already exists in movies table';
    END IF;
END $$;

