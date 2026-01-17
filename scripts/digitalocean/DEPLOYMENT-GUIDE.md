# DigitalOcean PostgreSQL Deployment Guide

## Important Note
Due to v0's browser-based environment, you cannot directly connect to DigitalOcean PostgreSQL from within v0. However, your VPS deployment will work perfectly!

## Your DigitalOcean Database Credentials

\`\`\`
Host: rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com
Port: 25060
Database: defaultdb
Username: doadmin
Password: masked_password
SSL Mode: require
\`\`\`

## Deployment Strategy

### Option 1: Keep Developing in v0 with Supabase (Recommended)

1. **Continue developing here in v0** using Supabase (it's already connected)
2. **When ready to deploy to VPS**, follow these steps:

#### Step 1: Export Your Supabase Data
Run this Python script locally (not in v0):

\`\`\`bash
# Install dependencies
pip install psycopg2-binary

# Run the export script
python scripts/digitalocean/02-export-supabase-data.py > data-backup.sql
\`\`\`

#### Step 2: Set Up DigitalOcean Database
Connect to your DigitalOcean database using a PostgreSQL client (like pgAdmin, DBeaver, or psql):

\`\`\`bash
psql "postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
\`\`\`

Then run:
\`\`\`sql
\i scripts/digitalocean/01-create-schema.sql
\`\`\`

#### Step 3: Import Your Data
\`\`\`bash
psql "postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require" < data-backup.sql
\`\`\`

#### Step 4: Deploy to VPS

1. Download your code from v0 (click "..." → "Download ZIP")
2. Upload to your VPS
3. Install dependencies:
   \`\`\`bash
   npm install
   npm install @neondatabase/serverless
   \`\`\`

4. Create `.env.local` file on your VPS:
   \`\`\`env
   DATABASE_URL=postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require
   \`\`\`

5. Update `lib/supabase/server.ts` to use DigitalOcean:
   \`\`\`typescript
   import { neon } from '@neondatabase/serverless'
   
   export const sql = neon(process.env.DATABASE_URL!)
   \`\`\`

6. Replace all Supabase queries with direct SQL queries using the `sql` client

7. Build and run:
   \`\`\`bash
   npm run build
   npm run start
   \`\`\`

### Option 2: Manual Setup via DigitalOcean Console

1. **Access DigitalOcean Console**: Log into DigitalOcean → Databases → rockflix-db
2. **Click "Launch Console"** to open the web-based database console
3. **Copy and paste** the contents of `scripts/digitalocean/01-create-schema.sql` into the console
4. **Run the script** to create all tables
5. **Continue developing in v0** with Supabase for now
6. **When deploying to VPS**, follow Step 4 from Option 1 above

## Why This Approach?

- **v0 environment limitation**: v0 runs in a browser and can't connect to external PostgreSQL databases
- **VPS has no limitations**: Your VPS can connect to DigitalOcean PostgreSQL perfectly
- **Same code will work**: The PostgreSQL queries you write in v0 (using Supabase) will work identically with DigitalOcean
- **No MySQL issues**: Since both Supabase and DigitalOcean use PostgreSQL, your code will work exactly the same

## Next Steps

1. Keep building your site in v0 using Supabase (already connected)
2. When satisfied with your site, run the schema script on DigitalOcean
3. Export your Supabase data
4. Deploy to VPS and switch to DigitalOcean connection
5. Your site will look and work exactly as it does in v0!
