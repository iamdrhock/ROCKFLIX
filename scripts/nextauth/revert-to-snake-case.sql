-- Revert column names back to snake_case
-- PostgresAdapter expects snake_case columns, not camelCase
-- This is why INSERT is failing with NULL ID

-- Revert accounts table columns
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

-- Revert sessions table columns
ALTER TABLE sessions RENAME COLUMN "sessionToken" TO session_token;
ALTER TABLE sessions RENAME COLUMN "userId" TO user_id;
ALTER TABLE sessions RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE sessions RENAME COLUMN "updatedAt" TO updated_at;

-- Revert users table columns
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

