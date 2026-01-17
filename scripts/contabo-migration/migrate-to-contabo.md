# Database Migration: DigitalOcean → Contabo PostgreSQL

## Overview
This guide will help you migrate your ROCKFLIX database from DigitalOcean PostgreSQL to Contabo PostgreSQL with **ZERO DOWNTIME** and minimal risk.

## Prerequisites
- ✅ Contabo PostgreSQL database created and running
- ✅ Adminer installed on Contabo (you have this)
- ✅ Access to DigitalOcean database credentials
- ✅ Access to Contabo database credentials
- ✅ SSH access to your server (RunCloud)

## Migration Strategy: Zero Downtime

### Phase 1: Preparation (30 minutes)
1. Export database schema
2. Create tables on Contabo
3. Test connection

### Phase 2: Data Migration (1-3 hours, depending on size)
1. Export data from DigitalOcean
2. Import data to Contabo
3. Verify data integrity

### Phase 3: Switchover (5 minutes)
1. Update environment variables
2. Restart application
3. Verify site is working

### Phase 4: Verification (15 minutes)
1. Test all features
2. Monitor for issues
3. Keep DigitalOcean as backup

---

## Step-by-Step Migration Guide

### Step 1: Export Database from DigitalOcean

#### Option A: Using Adminer on Contabo (Recommended)
1. Log into Adminer on Contabo
2. Connect to your DigitalOcean database:
   - **Server:** `rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com`
   - **Username:** `doadmin`
   - **Password:** `[Your DigitalOcean Password]`
   - **Database:** `defaultdb`
   - **Port:** `25060`
   - **SSL Mode:** `require`

3. Go to **SQL command** in Adminer
4. Run the export queries (see `export-all-data.sql`)

#### Option B: Using Admin API (Easiest)
1. Log into your admin panel: `https://rockflix.tv/arike`
2. Navigate to **Export Database** page (if available)
3. Click **Export to DigitalOcean**
4. Download the JSON file

#### Option C: Using pg_dump (Most Reliable)
```bash
# On your server (RunCloud)
pg_dump "postgresql://doadmin:[PASSWORD]@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  > digitalocean_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

### Step 2: Create Schema on Contabo

1. Log into Adminer on Contabo
2. Connect to your Contabo database:
   - **Server:** `[Your Contabo Database Host]`
   - **Username:** `[Your Contabo Username]`
   - **Password:** `[Your Contabo Password]`
   - **Database:** `[Your Contabo Database Name]`
   - **Port:** `[Your Contabo Port]` (usually 5432)

3. Go to **SQL command** in Adminer
4. Run the schema creation script (see `create-schema-contabo.sql`)
   - This will create all tables, indexes, and constraints
   - It will NOT delete existing data if tables already exist

---

### Step 3: Import Data to Contabo

#### Option A: Using Adminer Import Feature
1. In Adminer, go to **Import** tab
2. Select the SQL dump file from Step 1
3. Click **Execute**
4. Wait for import to complete

#### Option B: Using Adminer SQL Command
1. Copy the contents of `import-data-contabo.sql`
2. Paste into Adminer **SQL command** section
3. Click **Execute**

#### Option C: Using psql (Fastest for Large Databases)
```bash
# On your server
psql "postgresql://[USER]:[PASSWORD]@[CONTABO_HOST]:[PORT]/[DATABASE]" \
  < digitalocean_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

### Step 4: Verify Data Integrity

Run these verification queries in Adminer:

```sql
-- Check table counts
SELECT 'movies' as table_name, COUNT(*) as count FROM movies
UNION ALL SELECT 'genres', COUNT(*) FROM genres
UNION ALL SELECT 'actors', COUNT(*) FROM actors
UNION ALL SELECT 'seasons', COUNT(*) FROM seasons
UNION ALL SELECT 'episodes', COUNT(*) FROM episodes
UNION ALL SELECT 'users', COUNT(*) FROM profiles
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'posts', COUNT(*) FROM posts;

-- Check foreign key integrity
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';

-- Check sequences
SELECT 
  schemaname,
  sequencename,
  last_value
FROM pg_sequences;
```

---

### Step 5: Update Environment Variables

**⚠️ IMPORTANT: Do this during low-traffic period**

1. SSH into your server:
```bash
ssh runcloud@103.217.252.147
```

2. Edit your environment file:
```bash
cd /home/runcloud/webapps/rockflix/current
nano .env.production
```

3. Update these variables:
```env
# Old DigitalOcean (keep as backup)
# DATABASE_URL=postgresql://doadmin:[PASSWORD]@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require

# New Contabo (activate)
NEXT_PUBLIC_SUPABASE_URL=http://[CONTABO_HOST]:[PORT]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_CONTABO_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_CONTABO_SERVICE_KEY]

# OR use direct PostgreSQL connection
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[CONTABO_HOST]:[PORT]/[DATABASE]
```

4. **If using Supabase client** (current setup):
   - You'll need to update `lib/supabase/server.ts` to support Contabo
   - Or use a direct PostgreSQL connection instead

5. **If using direct PostgreSQL**:
   - Update connection in `lib/supabase/server.ts` or create new connection file

---

### Step 6: Update Application Code (If Needed)

If Contabo uses direct PostgreSQL (not Supabase):

1. Install PostgreSQL client:
```bash
npm install pg @types/pg
```

2. Create new connection file: `lib/database/contabo.ts`
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export { pool }
```

3. Update `lib/supabase/server.ts` to use Contabo connection when `DATABASE_URL` is set

---

### Step 7: Restart Application

```bash
# On your server
cd /home/runcloud/webapps/rockflix/current
npm run build
pm2 restart rockflix
```

---

### Step 8: Verify Site is Working

1. Visit `https://rockflix.tv`
2. Test these features:
   - ✅ Homepage loads
   - ✅ Movies/Series pages load
   - ✅ Search works
   - ✅ Watch page plays videos
   - ✅ Login/Register works
   - ✅ Admin panel accessible
   - ✅ Import functionality works

---

### Step 9: Monitor and Rollback (If Needed)

**If something goes wrong:**

1. **Immediate Rollback:**
```bash
# Revert environment variables
cd /home/runcloud/webapps/rockflix/current
nano .env.production
# Change back to DigitalOcean credentials
pm2 restart rockflix
```

2. **Keep DigitalOcean as backup for 7 days**
   - Don't delete DigitalOcean database immediately
   - Monitor Contabo for issues
   - Verify all features work correctly

---

## Estimated Time

- **Preparation:** 30 minutes
- **Data Export:** 15-30 minutes (depending on size)
- **Schema Creation:** 15 minutes
- **Data Import:** 1-3 hours (depending on size)
- **Verification:** 15 minutes
- **Switchover:** 5 minutes
- **Total:** 2-4 hours

---

## Data Size Considerations

- **Small (< 1GB):** 1-2 hours total
- **Medium (1-10GB):** 2-4 hours total
- **Large (> 10GB):** 4-8 hours total

---

## Risk Mitigation

1. **Export backup before migration**
2. **Test on staging first** (if available)
3. **Schedule during low-traffic period**
4. **Keep DigitalOcean as backup**
5. **Monitor error logs after switchover**
6. **Have rollback plan ready**

---

## Post-Migration Checklist

- [ ] All tables created successfully
- [ ] All data imported (verify counts match)
- [ ] Foreign keys intact
- [ ] Indexes created
- [ ] Sequences reset correctly
- [ ] Application connects successfully
- [ ] Homepage loads
- [ ] Search works
- [ ] Watch page works
- [ ] Admin panel accessible
- [ ] User authentication works
- [ ] Import functionality works
- [ ] No errors in logs
- [ ] Performance is acceptable

---

## Need Help?

If you encounter issues:
1. Check error logs: `pm2 logs rockflix`
2. Verify database connection in Adminer
3. Check environment variables
4. Verify Contabo database is accessible
5. Check firewall rules on Contabo

---

## Alternative: Gradual Migration

If you want even less risk:

1. **Dual-write mode:** Write to both databases
2. **Sync data:** Keep both databases in sync
3. **Switch reads:** Gradually switch reads to Contabo
4. **Switch writes:** Finally switch writes to Contabo
5. **Retire DigitalOcean:** After verification period

This requires code changes but provides maximum safety.

