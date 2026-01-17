-- FINAL FIX: Create tables with camelCase columns (what PostgresAdapter actually uses)
-- The adapter uses camelCase in JOIN queries (a.userId) but snake_case in INSERT (access_token)
-- We need camelCase for all columns

-- Drop all NextAuth tables
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Ensure uuid extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table with camelCase columns
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create accounts table with camelCase columns
CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refreshToken" TEXT,
  "accessToken" TEXT,
  "expiresAt" BIGINT,
  "tokenType" TEXT,
  scope TEXT,
  "idToken" TEXT,
  "sessionState" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, "providerAccountId")
);

-- Create sessions table with camelCase columns
CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create verification_tokens table
CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Create indexes with camelCase column names
CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_sessionToken ON sessions("sessionToken");
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create trigger function for updatedAt (camelCase)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify tables were created correctly
SELECT 
  table_name, 
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'accounts', 'sessions')
ORDER BY table_name, ordinal_position;

