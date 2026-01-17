-- Migrate existing country data from movies.country field to the new structure
-- This script extracts comma-separated countries and creates proper relationships

DO $$
DECLARE
  movie_record RECORD;
  country_name TEXT;
  country_id_var BIGINT;
BEGIN
  -- Loop through all movies that have a country value
  FOR movie_record IN 
    SELECT id, country 
    FROM movies 
    WHERE country IS NOT NULL AND country != ''
  LOOP
    -- Split the comma-separated countries
    FOR country_name IN 
      SELECT TRIM(unnest(string_to_array(movie_record.country, ',')))
    LOOP
      -- Skip empty strings
      IF country_name != '' THEN
        -- Insert country if it doesn't exist, or get existing id
        INSERT INTO countries (name)
        VALUES (country_name)
        ON CONFLICT (name) DO NOTHING;
        
        -- Get the country id
        SELECT id INTO country_id_var
        FROM countries
        WHERE name = country_name;
        
        -- Create the movie-country relationship
        INSERT INTO movie_countries (movie_id, country_id)
        VALUES (movie_record.id, country_id_var)
        ON CONFLICT (movie_id, country_id) DO NOTHING;
        
        RAISE NOTICE 'Linked movie % to country %', movie_record.id, country_name;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migration complete!';
END $$;
