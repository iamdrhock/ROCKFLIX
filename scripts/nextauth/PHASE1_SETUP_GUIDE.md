# NextAuth Phase 1 Setup - Complete Step-by-Step Guide

## STEP 1: Install NextAuth Packages on Server

**Run these commands on your server via SSH:**

```bash
ssh runcloud@103.217.252.147
cd /home/runcloud/webapps/rockflix/current
npm install next-auth@beta @auth/pg-adapter --legacy-peer-deps
```

**Wait for installation to complete**, then exit SSH:
```bash
exit
```

---

## STEP 2: Create NextAuth Tables in Contabo Database

### Option A: Using Adminer (Recommended - Easy)

1. **Open Adminer** in your browser (you mentioned you have it installed)

2. **Connect to Contabo Database:**
   - **System:** PostgreSQL
   - **Server:** Your Contabo database host (from `CONTABO_DATABASE_URL`)
   - **Username:** Your database username
   - **Password:** Your database password
   - **Database:** Your database name
   - Click **"Login"**

3. **Click on "SQL command"** (or "SQL" tab)

4. **Copy and paste this ENTIRE SQL script:**

```sql
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
```

5. **Click "Execute"** (or press Ctrl+Enter)

6. **Verify tables were created:**
   - Click on your database name in the left sidebar
   - You should see 4 new tables:
     - `nextauth_users`
     - `nextauth_accounts`
     - `nextauth_sessions`
     - `nextauth_verification_tokens`

### Option B: Using psql (Alternative)

If you prefer command line:

```bash
ssh runcloud@103.217.252.147
psql $CONTABO_DATABASE_URL -f /home/runcloud/webapps/rockflix/current/scripts/nextauth/create-nextauth-tables.sql
exit
```

---

## STEP 3: Add Environment Variables

**Connect to server and edit environment file:**

```bash
ssh runcloud@103.217.252.147
cd /home/runcloud/webapps/rockflix/current
nano .env
```

**Add these lines to your `.env` file:**

```env
# NextAuth Configuration
NEXTAUTH_URL=https://rockflix.tv
NEXTAUTH_SECRET=REPLACE_WITH_SECRET_KEY
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

**To generate NEXTAUTH_SECRET, run this command:**
```bash
openssl rand -base64 32
```

**Copy the output and paste it as the value for `NEXTAUTH_SECRET`**

**Save and exit nano:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter` to save

**Exit SSH:**
```bash
exit
```

---

## STEP 4: Upload Updated Files to Server

**From your local PowerShell (Windows), run these commands:**

```powershell
Get-Content -LiteralPath "lib\auth\nextauth-config.ts" | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > lib/auth/nextauth-config.ts"

Get-Content -LiteralPath "app\api\auth\[...nextauth]\route.ts" | ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && cat > app/api/auth/[...nextauth]/route.ts"
```

**Note:** After installing packages, you'll need to uncomment the code in these files (we'll do that in the next step).

---

## STEP 5: Uncomment NextAuth Code (After Packages Installed)

**Connect to server:**

```bash
ssh runcloud@103.217.252.147
cd /home/runcloud/webapps/rockflix/current
nano lib/auth/nextauth-config.ts
```

**Find these lines and uncomment them (remove the `/*` and `*/`):**

1. **Uncomment the imports** (lines 8-13):
   - Remove `/*` at the start
   - Remove `*/` at the end
   - Remove the `// TODO:` comment

2. **Uncomment the entire config object** (lines 26-118):
   - Remove `/*` at the start
   - Remove `*/` at the end
   - Remove the placeholder line: `export const nextAuthConfig = {} as any`

3. **Save and exit:**
   - Press `Ctrl + X`
   - Press `Y`
   - Press `Enter`

**Now edit the API route:**

```bash
nano app/api/auth/[...nextauth]/route.ts
```

**Uncomment the NextAuth handler** (lines 13-23):
- Remove `/*` and `*/`
- Remove the placeholder GET/POST functions (lines 25-32)

**Save and exit:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

**Exit SSH:**
```bash
exit
```

---

## STEP 6: Rebuild and Restart Application

```bash
ssh runcloud@103.217.252.147 "cd /home/runcloud/webapps/rockflix/current && npm run build && pm2 restart rockflix"
```

---

## STEP 7: Verify Setup

1. **Check NextAuth route:**
   - Visit: `https://rockflix.tv/api/auth/signin`
   - Should show NextAuth sign-in page (not 503 error)

2. **Check database tables:**
   - Open Adminer
   - Verify 4 tables exist: `nextauth_users`, `nextauth_accounts`, `nextauth_sessions`, `nextauth_verification_tokens`

3. **Check logs:**
   ```bash
   ssh runcloud@103.217.252.147
   pm2 logs rockflix --lines 50
   ```
   - Look for any NextAuth-related errors

---

## Troubleshooting

**If build fails:**
- Make sure packages are installed: `npm list next-auth @auth/pg-adapter`
- Check that all code is uncommented in `nextauth-config.ts`

**If tables don't exist:**
- Re-run the SQL script in Adminer
- Check for error messages in Adminer

**If environment variables missing:**
- Verify `.env` file has all required variables
- Restart PM2 after adding variables: `pm2 restart rockflix`

---

## Current Status After Phase 1

✅ NextAuth installed and configured  
✅ Database tables created  
✅ API route exists  
⚠️ **NextAuth is NOT active yet** - Supabase Auth still handles all authentication  
✅ **Site continues to work normally** - No user impact

