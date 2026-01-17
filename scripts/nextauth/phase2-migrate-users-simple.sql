-- Phase 2: User Migration Script (Simplified for Adminer)
-- Migrates users from profiles to NextAuth.js tables
-- Run each step separately if needed

-- Step 1: Ensure UUID extension is enabled (run this first)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Migrate users from profiles to nextauth_users
-- Run this separately if Step 1 works
INSERT INTO nextauth_users (id, email, name, email_verified, image, created_at, updated_at)
SELECT 
    p.id::TEXT,
    p.email,
    p.username,
    CASE WHEN p.email IS NOT NULL THEN NOW() ELSE NULL END,
    p.profile_picture_url,
    p.created_at,
    p.created_at  -- profiles table doesn't have updated_at, use created_at
FROM profiles p
WHERE p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM nextauth_users nu WHERE nu.id = p.id::TEXT
  )
ON CONFLICT (id) DO UPDATE
SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    image = EXCLUDED.image,
    updated_at = NOW();

-- Step 3: Create credential accounts for users with password_hash
-- Run this separately after Step 2
INSERT INTO nextauth_accounts (
    id, 
    user_id, 
    type, 
    provider, 
    provider_account_id, 
    created_at, 
    updated_at
)
SELECT 
    uuid_generate_v4()::TEXT,
    p.id::TEXT,
    'credentials',
    'credentials',
    p.id::TEXT,
    p.created_at,
    p.created_at  -- profiles table doesn't have updated_at, use created_at
FROM profiles p
WHERE p.password_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM nextauth_accounts na 
    WHERE na.user_id = p.id::TEXT 
      AND na.provider = 'credentials'
  )
ON CONFLICT (provider, provider_account_id) DO NOTHING;

