-- Create views to map NextAuth adapter table names to our prefixed table names
-- PostgresAdapter expects: users, accounts, sessions, verification_tokens
-- We created: nextauth_users, nextauth_accounts, nextauth_sessions, nextauth_verification_tokens

-- Drop views if they exist
DROP VIEW IF EXISTS users CASCADE;
DROP VIEW IF EXISTS accounts CASCADE;
DROP VIEW IF EXISTS sessions CASCADE;
DROP VIEW IF EXISTS verification_tokens CASCADE;

-- Create views that map to our actual tables
CREATE VIEW users AS SELECT * FROM nextauth_users;
CREATE VIEW accounts AS SELECT * FROM nextauth_accounts;
CREATE VIEW sessions AS SELECT * FROM nextauth_sessions;
CREATE VIEW verification_tokens AS SELECT * FROM nextauth_verification_tokens;

-- Grant permissions (same as underlying tables)
-- Views inherit permissions from base tables, but we need INSERT/UPDATE/DELETE to work
-- For write operations, we need to create INSTEAD OF triggers or use the base tables directly
-- Actually, views should work for reads, but for writes the adapter might need direct table access

-- Better solution: Create the tables with the expected names directly
-- But we'll keep both for backward compatibility

-- Alternative: Check if PostgresAdapter can be configured with custom table names
-- If not, we'll need to rename or create both sets

