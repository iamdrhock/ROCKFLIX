-- NextAuth.js Database Schema for Contabo PostgreSQL
-- This creates the required tables for NextAuth.js authentication

-- Users table (extends NextAuth default with additional fields)
CREATE TABLE IF NOT EXISTS nextauth_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table (OAuth providers, credentials, etc.)
CREATE TABLE IF NOT EXISTS nextauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nextauth_users(id) ON DELETE CASCADE,
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

-- Sessions table
CREATE TABLE IF NOT EXISTS nextauth_sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES nextauth_users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification tokens table (for email verification, password reset, etc.)
CREATE TABLE IF NOT EXISTS nextauth_verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_nextauth_accounts_user_id ON nextauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_nextauth_sessions_user_id ON nextauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_nextauth_sessions_session_token ON nextauth_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_nextauth_users_email ON nextauth_users(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_nextauth_users_updated_at ON nextauth_users;
CREATE TRIGGER update_nextauth_users_updated_at
    BEFORE UPDATE ON nextauth_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nextauth_accounts_updated_at ON nextauth_accounts;
CREATE TRIGGER update_nextauth_accounts_updated_at
    BEFORE UPDATE ON nextauth_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nextauth_sessions_updated_at ON nextauth_sessions;
CREATE TRIGGER update_nextauth_sessions_updated_at
    BEFORE UPDATE ON nextauth_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE nextauth_users IS 'NextAuth.js users table - stores user account information';
COMMENT ON TABLE nextauth_accounts IS 'NextAuth.js accounts table - links users to OAuth providers';
COMMENT ON TABLE nextauth_sessions IS 'NextAuth.js sessions table - stores active user sessions';
COMMENT ON TABLE nextauth_verification_tokens IS 'NextAuth.js verification tokens - for email verification and password reset';

