# Phase 3: Full NextAuth Switch Guide

## Overview

Phase 3 completes the migration to NextAuth.js by switching all authentication flows from Supabase Auth to NextAuth. This phase **activates** NextAuth as the primary authentication system.

## Status

✅ **Phase 1 Complete**: NextAuth tables created, API routes active
✅ **Phase 2 Complete**: Users migrated to NextAuth (5/5)
🔄 **Phase 3 In Progress**: Full authentication switch

## What Was Changed

### 1. Login Pages (`app/auth/login/page.tsx`)
- ✅ Switched from `supabase.auth.signInWithPassword()` to `signIn("credentials")`
- ✅ Switched Google OAuth from `supabase.auth.signInWithOAuth()` to `signIn("google")`
- ✅ Updated error handling for NextAuth responses

### 2. Sign-Up Pages (`app/auth/sign-up/page.tsx`)
- ✅ Switched Google sign-up to NextAuth `signIn("google")`
- ✅ Updated callback URL handling

### 3. Complete Profile Page (`app/auth/complete-profile/page.tsx`)
- ✅ Switched from Supabase session to NextAuth `useSession()`
- ✅ Updated password hashing to use bcryptjs
- ✅ Updated profile creation to use Contabo pool directly
- ✅ Creates NextAuth credential account automatically

### 4. Middleware (`middleware.ts`)
- ✅ Added dual authentication support (NextAuth + Supabase fallback)
- ✅ NextAuth used for user routes
- ✅ Supabase still used for admin routes (`/arike`, `/api/admin/login`)

### 5. NextAuth Configuration (`lib/auth/nextauth-config.ts`)
- ✅ Added `signIn` callback to handle Google OAuth account linking
- ✅ Automatically creates NextAuth accounts for existing users
- ✅ Links Google accounts to existing profiles

### 6. Session Provider (`app/layout.tsx`)
- ✅ Added `NextAuthSessionProvider` wrapper
- ✅ Enables `useSession()` hook in client components

### 7. Helper Functions
- ✅ Created `lib/auth/nextauth-helpers.ts` for server-side auth
- ✅ Created `lib/auth/nextauth-client-helpers.ts` for client-side auth
- ✅ Created `lib/auth/nextauth-middleware.ts` for route protection

## Environment Variables Required

Make sure these are set in your `.env`:

```bash
# NextAuth Configuration (Phase 1)
NEXTAUTH_URL=https://rockflix.tv
NEXTAUTH_SECRET=uuZJd9Smcf5Io2FKB+cS0MI1ua2vliPY72/R8OvUFA=

# Google OAuth (Phase 1)
GOOGLE_CLIENT_ID=304610101316-ueol0f604qc8mrj4ms39oivuaol729d3.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-zQap0rl7M7-W0ekzL_IiZexyEbE

# Database (already configured)
USE_CONTABO_DB=true

# Enable NextAuth (Phase 3)
USE_NEXTAUTH=true  # Set this to enable NextAuth (or omit, defaults to true)
```

## Testing Checklist

### ✅ Before Deployment

1. **Environment Variables**
   - [ ] `NEXTAUTH_URL` is set correctly
   - [ ] `NEXTAUTH_SECRET` is set (32+ character random string)
   - [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - [ ] `USE_CONTABO_DB=true` is set

2. **Database**
   - [ ] NextAuth tables exist (`nextauth_users`, `nextauth_accounts`, `nextauth_sessions`, `nextauth_verification_tokens`)
   - [ ] Users migrated (check `nextauth_users` table)
   - [ ] Credential accounts created (if users have passwords)

3. **Build Test**
   - [ ] `npm run build` succeeds without errors
   - [ ] No TypeScript errors
   - [ ] No missing dependencies

### ✅ After Deployment

1. **User Authentication**
   - [ ] Login with username/password works
   - [ ] Login with Google OAuth works
   - [ ] Sign up with Google works
   - [ ] Complete profile flow works
   - [ ] Session persists after page refresh

2. **Protected Routes**
   - [ ] `/settings` requires authentication
   - [ ] `/community/bookmarks` requires authentication
   - [ ] Unauthenticated users redirected to `/auth/login`

3. **Admin Routes**
   - [ ] `/arike` still works (uses Supabase admin auth)
   - [ ] Admin login independent of NextAuth

4. **Existing Users**
   - [ ] Existing users can log in (auto-migration works)
   - [ ] Google OAuth users can re-authenticate
   - [ ] Profiles are created/updated correctly

## Known Limitations

### ⚠️ OAuth Users
- Users who previously logged in with Google will need to **re-authenticate** once
- Their Google account will be linked to NextAuth on first login
- Existing user data is preserved

### ⚠️ Passwords
- Users without `password_hash` in `profiles` table can't use credential login
- They must use Google OAuth or complete profile to set a password

### ⚠️ Dual Authentication
- Admin routes still use Supabase Auth (intentional)
- User routes use NextAuth
- This allows gradual migration without breaking admin access

## Rollback Plan

If issues occur, you can quickly rollback by:

1. **Set environment variable:**
   ```bash
   USE_NEXTAUTH=false
   ```

2. **Restart application:**
   ```bash
   pm2 restart rockflix
   ```

This will revert to Supabase Auth for all routes.

## Next Steps After Phase 3

Once Phase 3 is stable:

1. **Monitor for 24-48 hours**
   - Watch for authentication errors
   - Monitor user login success rate
   - Check session creation rate

2. **Optional: Remove Supabase Auth**
   - After confirming NextAuth works 100%
   - Can remove Supabase Auth dependencies
   - Simplify codebase

3. **Performance Optimization**
   - Monitor NextAuth session performance
   - Optimize database queries if needed

## Troubleshooting

### Users Can't Log In

**Check:**
1. Is `NEXTAUTH_SECRET` set correctly?
2. Are NextAuth tables accessible?
3. Check server logs for NextAuth errors
4. Verify user exists in `nextauth_users` table

**Fix:**
- Ensure all environment variables are set
- Run Phase 2 migration again if needed
- Check database connection

### Google OAuth Not Working

**Check:**
1. Is `GOOGLE_CLIENT_ID` set correctly?
2. Is `GOOGLE_CLIENT_SECRET` set correctly?
3. Is redirect URL configured in Google Console?
4. Check NextAuth callback URL

**Fix:**
- Verify Google OAuth credentials in `.env`
- Ensure redirect URL includes `/api/auth/callback/google`
- Check Google Console settings

### Session Not Persisting

**Check:**
1. Is `NEXTAUTH_SECRET` set?
2. Are cookies being set correctly?
3. Check browser console for cookie errors

**Fix:**
- Ensure `NEXTAUTH_URL` matches your domain
- Check cookie settings in NextAuth config
- Verify database sessions table is working

## Support

If you encounter issues:
1. Check server logs for NextAuth errors
2. Verify database connection to Contabo
3. Test with a test user account first
4. Use rollback plan if critical issues occur

---

**Status:** Phase 3 Implementation Complete ✅
**Next:** Testing and Verification

