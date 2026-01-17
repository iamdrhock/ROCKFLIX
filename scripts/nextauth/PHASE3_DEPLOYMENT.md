# Phase 3: Deployment Instructions

## Quick Summary

Phase 3 switches authentication from Supabase Auth to NextAuth.js. All authentication pages and middleware have been updated to use NextAuth.

## Files Changed

### Core Authentication
1. `app/auth/login/page.tsx` - NextAuth login
2. `app/auth/sign-up/page.tsx` - NextAuth sign-up  
3. `app/auth/complete-profile/page.tsx` - NextAuth profile completion
4. `middleware.ts` - NextAuth session checking
5. `app/layout.tsx` - Added NextAuth SessionProvider

### NextAuth Configuration
6. `lib/auth/nextauth-config.ts` - Added signIn callback for OAuth linking
7. `lib/auth/nextauth-helpers.ts` - Server-side auth helpers
8. `lib/auth/nextauth-client-helpers.ts` - Client-side auth helpers
9. `lib/auth/nextauth-middleware.ts` - NextAuth middleware
10. `components/providers/session-provider.tsx` - Session provider wrapper

### Migration API
11. `app/api/admin/auth/migrate-users/route.ts` - Fixed UUID generation

## Environment Variables

Ensure these are set:

```bash
NEXTAUTH_URL=https://rockflix.tv
NEXTAUTH_SECRET=uuZJd9Smcf5Io2FKB+cS0MI1ua2vliPY72/R8OvUFA=
GOOGLE_CLIENT_ID=304610101316-ueol0f604qc8mrj4ms39oivuaol729d3.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-zQap0rl7M7-W0ekzL_IiZexyEbE
USE_CONTABO_DB=true
```

## Upload Commands

```powershell
# Upload authentication pages
$content = Get-Content -LiteralPath "app\auth\login\page.tsx" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > app/auth/login/page.tsx"
$content = Get-Content -LiteralPath "app\auth\sign-up\page.tsx" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > app/auth/sign-up/page.tsx"
$content = Get-Content -LiteralPath "app\auth\complete-profile\page.tsx" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > app/auth/complete-profile/page.tsx"

# Upload middleware and config
$content = Get-Content -LiteralPath "middleware.ts" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > middleware.ts"
$content = Get-Content -LiteralPath "app\layout.tsx" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > app/layout.tsx"

# Upload NextAuth helpers and config
$content = Get-Content -LiteralPath "lib\auth\nextauth-config.ts" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > lib/auth/nextauth-config.ts"
$content = Get-Content -LiteralPath "lib\auth\nextauth-helpers.ts" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > lib/auth/nextauth-helpers.ts"
$content = Get-Content -LiteralPath "lib\auth\nextauth-client-helpers.ts" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > lib/auth/nextauth-client-helpers.ts"
$content = Get-Content -LiteralPath "lib\auth\nextauth-middleware.ts" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > lib/auth/nextauth-middleware.ts"

# Upload session provider
$content = Get-Content -LiteralPath "components\providers\session-provider.tsx" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && mkdir -p components/providers && cat > components/providers/session-provider.tsx"

# Upload migration API
$content = Get-Content -LiteralPath "app\api\admin\auth\migrate-users\route.ts" -Raw; $content | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && mkdir -p app/api/admin/auth/migrate-users && cat > app/api/admin/auth/migrate-users/route.ts"

# Rebuild and restart
ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && npm run build && pm2 restart rockflix"
```

## Testing After Deployment

1. **Test Login**
   - Go to `/auth/login`
   - Try username/password login
   - Try Google OAuth login
   - Verify session is created

2. **Test Sign Up**
   - Go to `/auth/sign-up`
   - Try Google sign-up
   - Complete profile flow
   - Verify user is created

3. **Test Protected Routes**
   - Go to `/settings` (should require login)
   - Go to `/community/bookmarks` (should require login)

4. **Check Admin Login**
   - Go to `/arike`
   - Verify admin login still works (Supabase admin auth)

5. **Monitor Logs**
   - Check server logs for NextAuth errors
   - Watch for authentication failures
   - Monitor session creation

## Rollback (If Needed)

If critical issues occur:

```bash
# Set environment variable to disable NextAuth
ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && echo 'USE_NEXTAUTH=false' >> .env"

# Restart application
ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && pm2 restart rockflix"
```

This will revert to Supabase Auth automatically.

---

**Status:** Ready for Deployment ✅

