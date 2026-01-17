-- REVERT TO CAMELCASE: PostgresAdapter expects camelCase column names
-- The adapter uses camelCase in its queries, so we need camelCase columns

-- Rename accounts table columns back to camelCase
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

-- Rename sessions table columns back to camelCase
ALTER TABLE sessions RENAME COLUMN session_token TO "sessionToken";
ALTER TABLE sessions RENAME COLUMN user_id TO "userId";
ALTER TABLE sessions RENAME COLUMN created_at TO "createdAt";
ALTER TABLE sessions RENAME COLUMN updated_at TO "updatedAt";

-- Rename users table columns back to camelCase
ALTER TABLE users RENAME COLUMN email_verified TO "emailVerified";
ALTER TABLE users RENAME COLUMN created_at TO "createdAt";
ALTER TABLE users RENAME COLUMN updated_at TO "updatedAt";

-- Update indexes to match camelCase column names
DROP INDEX IF EXISTS idx_accounts_user_id;
CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts("userId");

DROP INDEX IF EXISTS idx_sessions_user_id;
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions("userId");

DROP INDEX IF EXISTS idx_sessions_session_token;
CREATE INDEX IF NOT EXISTS idx_sessions_sessionToken ON sessions("sessionToken");

-- Update trigger function to use camelCase
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Verify column names
SELECT 
  table_name, 
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'accounts', 'sessions')
ORDER BY table_name, ordinal_position;

