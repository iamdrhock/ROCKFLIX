-- Phase 2: User Migration Script
-- Migrates users from Supabase auth.users to NextAuth.js tables
-- Run this AFTER Phase 1 setup is complete

-- Enable UUID extension (required for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Migrate users from profiles table to nextauth_users
-- This assumes profiles already have id, email, username, password_hash
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

-- Step 2: Create credential accounts for users with password_hash
-- NextAuth credentials provider stores passwords in the profiles table
-- But we need to create an account record for NextAuth to recognize the user
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
    p.id::TEXT, -- Use user ID as provider_account_id for credentials
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

-- Step 3: Verify migration results
SELECT 
    'Migrated Users' as status,
    COUNT(*) as count
FROM nextauth_users
UNION ALL
SELECT 
    'Credential Accounts' as status,
    COUNT(*) as count
FROM nextauth_accounts
WHERE provider = 'credentials'
UNION ALL
SELECT 
    'Profiles with Email' as status,
    COUNT(*) as count
FROM profiles
WHERE email IS NOT NULL
UNION ALL
SELECT 
    'Profiles with Password' as status,
    COUNT(*) as count
FROM profiles
WHERE password_hash IS NOT NULL;

-- Step 4: Show users that need attention (missing email or password_hash)
SELECT 
    id,
    username,
    email,
    CASE 
        WHEN email IS NULL THEN 'Missing email'
        WHEN password_hash IS NULL THEN 'No password (OAuth only?)'
        ELSE 'OK'
    END as status
FROM profiles
WHERE email IS NULL OR (password_hash IS NULL AND id NOT IN (
    SELECT user_id::UUID FROM nextauth_accounts WHERE provider != 'credentials'
))
ORDER BY created_at DESC
LIMIT 20;

