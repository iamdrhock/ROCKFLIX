-- FIX NULL ID ISSUE: Add DEFAULT gen_random_uuid()::TEXT to all id columns
-- The PostgresAdapter should generate IDs, but if it doesn't, the DEFAULT will handle it

-- Ensure uuid extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fix users table id column
ALTER TABLE users 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- Fix accounts table id column  
ALTER TABLE accounts 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- Fix sessions table id column (THIS IS THE KEY ONE CAUSING THE ERROR)
ALTER TABLE sessions 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- Verify the changes
SELECT 
  table_name, 
  column_name, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'accounts', 'sessions')
  AND column_name = 'id'
ORDER BY table_name;

