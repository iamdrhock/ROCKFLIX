-- Check actual column names in the database
SELECT 
  table_name, 
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'accounts', 'sessions')
ORDER BY table_name, ordinal_position;

