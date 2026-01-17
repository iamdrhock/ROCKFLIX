-- Fix NextAuth table names for PostgresAdapter
-- PostgresAdapter expects: users, accounts, sessions, verification_tokens
-- We need to either rename our tables or create aliases

-- Option 1: Rename tables (if no data exists yet)
-- ALTER TABLE nextauth_users RENAME TO users;
-- ALTER TABLE nextauth_accounts RENAME TO accounts;
-- ALTER TABLE nextauth_sessions RENAME TO sessions;
-- ALTER TABLE nextauth_verification_tokens RENAME TO verification_tokens;

-- Option 2: Create the tables with correct names (safer - keep both)
-- Drop existing tables with correct names if they exist
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;

-- Create tables with names PostgresAdapter expects
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migrate data from nextauth_* tables if they exist and have data
-- This will copy any existing users/accounts/sessions from nextauth_* tables
INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at)
SELECT id, name, email, email_verified, image, created_at, updated_at
FROM nextauth_users
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, created_at, updated_at)
SELECT id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, created_at, updated_at
FROM nextauth_accounts
ON CONFLICT (provider, provider_account_id) DO NOTHING;

INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
SELECT id, session_token, user_id, expires, created_at, updated_at
FROM nextauth_sessions
ON CONFLICT (id) DO NOTHING;

INSERT INTO verification_tokens (identifier, token, expires)
SELECT identifier, token, expires
FROM nextauth_verification_tokens
ON CONFLICT (identifier, token) DO NOTHING;

