-- FINAL FIX: Rename all columns to snake_case as PostgresAdapter expects
-- The adapter is looking for access_token, not accessToken

-- Rename accounts table columns to snake_case
ALTER TABLE accounts RENAME COLUMN "userId" TO user_id;
ALTER TABLE accounts RENAME COLUMN "providerAccountId" TO provider_account_id;
ALTER TABLE accounts RENAME COLUMN "refreshToken" TO refresh_token;
ALTER TABLE accounts RENAME COLUMN "accessToken" TO access_token;
ALTER TABLE accounts RENAME COLUMN "expiresAt" TO expires_at;
ALTER TABLE accounts RENAME COLUMN "tokenType" TO token_type;
ALTER TABLE accounts RENAME COLUMN "idToken" TO id_token;
ALTER TABLE accounts RENAME COLUMN "sessionState" TO session_state;
ALTER TABLE accounts RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE accounts RENAME COLUMN "updatedAt" TO updated_at;

-- Rename sessions table columns to snake_case
ALTER TABLE sessions RENAME COLUMN "sessionToken" TO session_token;
ALTER TABLE sessions RENAME COLUMN "userId" TO user_id;
ALTER TABLE sessions RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE sessions RENAME COLUMN "updatedAt" TO updated_at;

-- Rename users table columns to snake_case
ALTER TABLE users RENAME COLUMN "emailVerified" TO email_verified;
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;

-- Update indexes to match snake_case column names
DROP INDEX IF EXISTS idx_accounts_userId;
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

DROP INDEX IF EXISTS idx_sessions_userId;
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

DROP INDEX IF EXISTS idx_sessions_sessionToken;
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);

-- Update trigger function to use snake_case
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers should still work, but verify they reference updated_at correctly
-- (They should since we're updating the function above)

-- Verify column names
SELECT 
  table_name, 
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'accounts', 'sessions')
ORDER BY table_name, ordinal_position;

