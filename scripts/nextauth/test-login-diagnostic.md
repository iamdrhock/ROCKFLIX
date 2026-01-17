# Login Diagnostic Test

## Test Plan

### 1. Test Credentials Login (Username/Password)
- Go to: https://rockflix.tv/auth/login
- Try logging in with an existing username/password
- Check browser console for errors
- Check server logs

### 2. Test Google Login
- Go to: https://rockflix.tv/auth/login
- Click "Continue with Google"
- Complete Google OAuth flow
- Check browser console for errors
- Check server logs

### 3. Check Database State
Run these SQL queries in Adminer:

```sql
-- Check if users table exists and has correct schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check if accounts table exists and has correct schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
ORDER BY ordinal_position;

-- Check existing users
SELECT id, email, name, created_at FROM users LIMIT 10;

-- Check existing accounts
SELECT id, user_id, provider, provider_account_id, created_at FROM accounts LIMIT 10;

-- Check if any user has a password_hash in profiles
SELECT id, username, email, password_hash IS NOT NULL as has_password 
FROM profiles 
WHERE password_hash IS NOT NULL 
LIMIT 10;
```

### 4. Check Environment Variables
```bash
ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && grep -E 'NEXTAUTH|GOOGLE' .env"
```

### 5. Check Server Logs
```bash
ssh runcloud@103.217.252.147 "pm2 logs rockflix --lines 100 --nostream | grep -iE 'nextauth|error|auth|login|signin|callback|credentials|google' | tail -100"
```

## Expected Results

### If ONLY Google Login Fails:
- Credentials login should work
- Error will be in Google OAuth callback
- Check: `signIn` callback, account linking, OAuth redirect URI

### If BOTH Login Methods Fail:
- NextAuth configuration issue
- Database connection issue
- Session/JWT issue
- Check: `nextauth-config.ts`, database pool, session strategy

### If Credentials Login Works but Google Doesn't:
- Google OAuth configuration issue
- Account linking issue
- Check: Google Cloud Console, redirect URI, `signIn` callback

