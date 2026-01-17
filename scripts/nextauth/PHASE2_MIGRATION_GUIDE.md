# Phase 2: User Migration Guide

## Overview

Phase 2 migrates existing users from Supabase Auth to NextAuth.js. This phase runs **in parallel** with Supabase Auth, so existing authentication continues to work while we migrate users.

## Goals

1. ✅ Migrate users from `profiles` table to `nextauth_users` table
2. ✅ Create credential accounts in `nextauth_accounts` for users with passwords
3. ✅ Enable auto-migration during login (users are migrated on-the-fly)
4. ✅ Zero downtime - existing users can still log in via Supabase Auth
5. ✅ New users can use NextAuth immediately

## Prerequisites

- ✅ Phase 1 completed (NextAuth tables created)
- ✅ NextAuth API routes active (`/api/auth/[...nextauth]`)
- ✅ Environment variables configured (`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

## Migration Process

### Option 1: Automatic Migration (Recommended)

**No manual action required!** Users are automatically migrated to NextAuth when they log in. This happens transparently:

1. User logs in with username/password
2. System checks if user exists in `nextauth_users`
3. If not, user is automatically migrated
4. User logs in successfully

### Option 2: Bulk Migration (Admin API)

If you want to migrate all users upfront:

1. **Log in to admin panel** at `/arike`
2. **Go to Migration section** (if available)
3. **Click "Migrate All Users"** button
4. **Wait for migration to complete** (usually takes a few seconds)

Or use the API directly:

```bash
# Check migration status
curl -X GET https://rockflix.tv/api/admin/auth/migrate-users \
  -H "Cookie: your-admin-session-cookie"

# Run migration
curl -X POST https://rockflix.tv/api/admin/auth/migrate-users \
  -H "Cookie: your-admin-session-cookie"
```

### Option 3: Manual SQL Migration

Run the SQL script directly in Adminer:

```sql
-- Run scripts/nextauth/phase2-migrate-users.sql
-- This will migrate all users at once
```

## What Gets Migrated

### Users (`profiles` → `nextauth_users`)

- ✅ `id` → `id` (converted to TEXT)
- ✅ `email` → `email`
- ✅ `username` → `name`
- ✅ `profile_picture_url` → `image`
- ✅ `created_at` → `created_at`
- ✅ `email_verified` → Set to `NOW()` if email exists

### Credential Accounts (`profiles` → `nextauth_accounts`)

For users with `password_hash`:
- ✅ Create account with `provider = 'credentials'`
- ✅ `provider_account_id` = user ID
- ✅ `type` = `'credentials'`

**Note:** Passwords remain in `profiles.password_hash` - NextAuth reads from there for credentials provider.

## Verification

### Check Migration Status

```sql
-- Total profiles vs migrated users
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL) as total_profiles,
  (SELECT COUNT(*) FROM nextauth_users) as migrated_users,
  (SELECT COUNT(*) FROM nextauth_accounts WHERE provider = 'credentials') as credential_accounts;

-- Users not yet migrated
SELECT p.id, p.username, p.email
FROM profiles p
WHERE p.email IS NOT NULL
  AND p.id NOT IN (SELECT id::UUID FROM nextauth_users)
LIMIT 10;
```

### Test Authentication

1. **Test existing user login:**
   - Try logging in with an existing username/password
   - User should be auto-migrated on first login
   - Login should succeed

2. **Check NextAuth session:**
   - After login, check `/api/auth/session`
   - Should return user session data

## Important Notes

### 🔒 Security

- **Passwords are NOT copied** - NextAuth reads from `profiles.password_hash`
- **Password hashes remain unchanged** - No re-hashing required
- **OAuth accounts** - Users who logged in with Google will need to re-link their Google account after full NextAuth switch

### ⚠️ OAuth Users (Google Login)

Users who previously logged in with Google OAuth:
- ✅ User record is migrated to `nextauth_users`
- ⚠️ OAuth account link needs to be re-established
- 🔄 They'll need to log in with Google again once NextAuth is fully active

### 🔄 Dual Authentication

During Phase 2:
- ✅ **Existing users** can still log in via Supabase Auth
- ✅ **Migrated users** can log in via NextAuth
- ✅ **New users** can use NextAuth immediately
- ✅ **Auto-migration** ensures users move to NextAuth gradually

## Troubleshooting

### Users Not Migrating

**Issue:** Users exist in `profiles` but not in `nextauth_users`

**Solution:**
1. Check if users have `email` field set:
   ```sql
   SELECT COUNT(*) FROM profiles WHERE email IS NULL;
   ```
2. Run manual migration SQL script
3. Or wait for auto-migration on next login

### Password Login Not Working

**Issue:** Users can't log in after migration

**Solution:**
1. Verify `password_hash` exists in `profiles` table
2. Check if credential account was created:
   ```sql
   SELECT * FROM nextauth_accounts 
   WHERE user_id = 'user-id-here' AND provider = 'credentials';
   ```
3. Check NextAuth logs for errors

### Missing OAuth Accounts

**Issue:** Google login users can't log in

**Solution:**
1. OAuth accounts need to be manually migrated or re-linked
2. Users will need to authenticate with Google again in Phase 3
3. For now, they can use password reset if they have email access

## Next Steps

After Phase 2 is complete:
- ✅ All users migrated to NextAuth
- ✅ Credential accounts created
- ✅ Auto-migration working

**Ready for Phase 3:**
- Switch authentication system to NextAuth-only
- Disable Supabase Auth endpoints
- Update frontend to use NextAuth exclusively

## Migration Statistics

After running migration, you'll see:

```json
{
  "success": true,
  "stats": {
    "totalProfiles": 150,
    "migratedUsers": 150,
    "credentialAccounts": 120,
    "oauthAccounts": 0,
    "warnings": [
      "Found 30 users without passwords (likely OAuth-only)"
    ]
  }
}
```

## Support

If you encounter issues:
1. Check server logs for migration errors
2. Verify database connection to Contabo
3. Ensure NextAuth tables exist (Phase 1)
4. Check admin authentication is working

---

**Status:** Phase 2 Complete ✅
**Next:** Phase 3 - Full NextAuth Switch

