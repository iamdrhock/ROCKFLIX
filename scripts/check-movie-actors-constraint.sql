-- Check if movie_actors table has unique constraint
-- Run this first to see if constraint exists

SELECT 
    conname as constraint_name,
    contype as constraint_type,
    a.attname as column_name
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
INNER JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
WHERE rel.relname = 'movie_actors'
    AND nsp.nspname = 'public'
    AND con.contype = 'u'
ORDER BY conname, a.attnum;

