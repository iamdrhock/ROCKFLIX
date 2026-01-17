# QUICK LOGIN TEST - Determine the Issue

## Test 1: Credentials Login (Username/Password)

1. Go to: https://rockflix.tv/auth/login
2. Open browser DevTools (F12) → Console tab
3. Try logging in with a username/password that you KNOW exists
4. **What happens?**
   - ✅ Successfully logs in → **Credentials login WORKS**
   - ❌ Shows error → **Credentials login BROKEN**

**If it fails, check console for error message and share it.**

---

## Test 2: Google Login

1. Go to: https://rockflix.tv/auth/login
2. Open browser DevTools (F12) → Console tab
3. Click "Continue with Google"
4. Complete Google OAuth flow
5. **What happens?**
   - ✅ Successfully logs in → **Google login WORKS**
   - ❌ Redirects to error page → **Google login BROKEN**
   - ❌ Stuck on loading → **Google login BROKEN**

**If it fails, check console for error message and share it.**

---

## Test 3: Check Server Logs

Run this command and share the output:

```powershell
ssh runcloud@103.217.252.147 "pm2 logs rockflix --lines 200 --nostream | grep -iE 'nextauth|error|auth|login|signin|callback|credentials|google|CredentialsSignin' | tail -100"
```

---

## Test 4: Check Database

Run this in Adminer to see if users exist:

```sql
-- Check if any users have passwords
SELECT id, username, email, password_hash IS NOT NULL as has_password 
FROM profiles 
WHERE password_hash IS NOT NULL 
LIMIT 5;

-- Check NextAuth users table
SELECT id, email, name, created_at FROM users LIMIT 5;

-- Check NextAuth accounts table
SELECT id, user_id, provider, provider_account_id, created_at FROM accounts LIMIT 5;
```

---

## Expected Results Based on Issue:

### Scenario A: ONLY Google Login Fails
- Credentials login works ✅
- Google login fails ❌
- **Issue:** Google OAuth configuration or account linking

### Scenario B: BOTH Login Methods Fail
- Credentials login fails ❌
- Google login fails ❌
- **Issue:** NextAuth configuration, database connection, or session/JWT

### Scenario C: Credentials Works, Google Doesn't
- Credentials login works ✅
- Google login fails ❌
- **Issue:** Google OAuth redirect URI, signIn callback, or account creation

---

**Please run these tests and share the results so we can identify the exact issue!**

