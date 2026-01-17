-- Debug script: Check why credential accounts weren't created
-- Run this to diagnose the issue

-- Check 1: Do profiles have password_hash?
SELECT 
    'Profiles with password_hash' as check_type,
    COUNT(*) as count
FROM profiles
WHERE password_hash IS NOT NULL

UNION ALL

-- Check 2: How many users have both email AND password_hash?
SELECT 
    'Profiles with email AND password_hash' as check_type,
    COUNT(*) as count
FROM profiles
WHERE email IS NOT NULL 
  AND password_hash IS NOT NULL

UNION ALL

-- Check 3: Check if accounts already exist (should be 0)
SELECT 
    'Existing credential accounts' as check_type,
    COUNT(*) as count
FROM nextauth_accounts
WHERE provider = 'credentials'

UNION ALL

-- Check 4: Profiles that SHOULD get credential accounts
SELECT 
    'Profiles needing credential accounts' as check_type,
    COUNT(*) as count
FROM profiles p
WHERE p.password_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM nextauth_accounts na 
    WHERE na.user_id = p.id::TEXT 
      AND na.provider = 'credentials'
  );

-- Detailed view: Show profiles and their password_hash status
SELECT 
    p.id,
    p.username,
    p.email,
    CASE 
        WHEN p.password_hash IS NULL THEN '❌ No password'
        WHEN LENGTH(p.password_hash) = 0 THEN '⚠️ Empty password'
        ELSE '✅ Has password'
    END as password_status,
    LENGTH(p.password_hash) as password_hash_length,
    CASE 
        WHEN na.id IS NOT NULL THEN '✅ Account exists'
        ELSE '❌ No account'
    END as account_status
FROM profiles p
LEFT JOIN nextauth_accounts na ON na.user_id = p.id::TEXT AND na.provider = 'credentials'
WHERE p.email IS NOT NULL
ORDER BY p.created_at DESC;

