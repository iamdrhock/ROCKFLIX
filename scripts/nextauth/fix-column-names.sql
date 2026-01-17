-- Fix column names to match PostgresAdapter expectations (camelCase)
-- The adapter expects camelCase columns, but we created snake_case columns

-- Rename columns in accounts table
ALTER TABLE accounts RENAME COLUMN user_id TO "userId";
ALTER TABLE accounts RENAME COLUMN provider_account_id TO "providerAccountId";
ALTER TABLE accounts RENAME COLUMN refresh_token TO "refreshToken";
ALTER TABLE accounts RENAME COLUMN access_token TO "accessToken";
ALTER TABLE accounts RENAME COLUMN expires_at TO "expiresAt";
ALTER TABLE accounts RENAME COLUMN token_type TO "tokenType";
ALTER TABLE accounts RENAME COLUMN id_token TO "idToken";
ALTER TABLE accounts RENAME COLUMN session_state TO "sessionState";
ALTER TABLE accounts RENAME COLUMN created_at TO "createdAt";
ALTER TABLE accounts RENAME COLUMN updated_at TO "updatedAt";

-- Rename columns in sessions table
ALTER TABLE sessions RENAME COLUMN session_token TO "sessionToken";
ALTER TABLE sessions RENAME COLUMN user_id TO "userId";
ALTER TABLE sessions RENAME COLUMN created_at TO "createdAt";
ALTER TABLE sessions RENAME COLUMN updated_at TO "updatedAt";

-- Rename columns in users table
ALTER TABLE users RENAME COLUMN email_verified TO "emailVerified";
ALTER TABLE users RENAME COLUMN created_at TO "createdAt";
ALTER TABLE users RENAME COLUMN updated_at TO "updatedAt";

-- Note: verification_tokens table doesn't need changes as it doesn't use foreign keys in joins
-- But we should check if expires_at needs to be renamed
-- Actually, verification_tokens might need: identifier, token, expires (these seem OK)

-- Update indexes to reference new column names
DROP INDEX IF EXISTS idx_accounts_user_id;
CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts("userId");

DROP INDEX IF EXISTS idx_sessions_user_id;
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions("userId");

DROP INDEX IF EXISTS idx_sessions_session_token;
CREATE INDEX IF NOT EXISTS idx_sessions_sessionToken ON sessions("sessionToken");

-- Update foreign key constraints (PostgreSQL will handle this automatically, but verify)
-- The foreign key references should still work even after column rename

