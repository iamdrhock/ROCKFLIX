-- Verify actual column names in NextAuth tables
-- This will show us what the PostgresAdapter is actually expecting

-- Check accounts table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
ORDER BY ordinal_position;

-- Check users table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check sessions table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;

