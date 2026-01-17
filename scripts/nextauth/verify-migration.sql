-- Verify Phase 2 Migration Status
-- Run this after migration to check results

-- Check migration status
SELECT 
    'Total Profiles (with email)' as metric,
    COUNT(*)::TEXT as value
FROM profiles
WHERE email IS NOT NULL

UNION ALL

SELECT 
    'Migrated Users (nextauth_users)' as metric,
    COUNT(*)::TEXT as value
FROM nextauth_users

UNION ALL

SELECT 
    'Credential Accounts' as metric,
    COUNT(*)::TEXT as value
FROM nextauth_accounts
WHERE provider = 'credentials'

UNION ALL

SELECT 
    'Unmigrated Users' as metric,
    COUNT(*)::TEXT as value
FROM profiles p
WHERE p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM nextauth_users nu WHERE nu.id = p.id::TEXT
  )

UNION ALL

SELECT 
    'Profiles with Password Hash' as metric,
    COUNT(*)::TEXT as value
FROM profiles
WHERE password_hash IS NOT NULL

UNION ALL

SELECT 
    'Unmigrated Credentials' as metric,
    COUNT(*)::TEXT as value
FROM profiles p
WHERE p.password_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM nextauth_accounts na 
    WHERE na.user_id = p.id::TEXT AND na.provider = 'credentials'
  );

-- Show detailed user migration status
SELECT 
    p.id,
    p.username,
    p.email,
    CASE 
        WHEN nu.id IS NOT NULL THEN '✅ Migrated'
        ELSE '❌ Not Migrated'
    END as user_status,
    CASE 
        WHEN na.id IS NOT NULL THEN '✅ Has Account'
        WHEN p.password_hash IS NOT NULL THEN '⚠️ No Account (has password)'
        ELSE 'ℹ️ No Account (no password)'
    END as account_status
FROM profiles p
LEFT JOIN nextauth_users nu ON nu.id = p.id::TEXT
LEFT JOIN nextauth_accounts na ON na.user_id = p.id::TEXT AND na.provider = 'credentials'
WHERE p.email IS NOT NULL
ORDER BY p.created_at DESC;

