# DigitalOcean → Contabo Migration Guide

## Step 1: Verify Your DigitalOcean Database

### From DigitalOcean Dashboard:

1. **Check Database Stats:**
   - Look at the "Overview" or "Metrics" tab
   - Note: Number of databases, connections, storage used
   - This confirms your database is active

2. **View Tables (if available in dashboard):**
   - Go to "Databases" → Your DB → "Tables" or "SQL Editor"
   - Run this query to list all tables:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```

3. **Check Record Counts:**
   ```sql
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
     (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as column_count
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

## Step 2: Export from DigitalOcean

### Option A: Using DigitalOcean Backup (Easiest)

1. **In DigitalOcean Dashboard:**
   - Go to your database → "Backups" tab
   - Click "Create Backup" or use the latest backup
   - Download the backup file (usually `.sql.gz` or `.dump`)

2. **Or use pg_dump from your server:**
   ```bash
   # On your Contabo server (with DigitalOcean DB access)
   PGPASSWORD='masked_password' pg_dump \
     -h rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com \
     -p 25060 \
     -U doadmin \
     -d defaultdb \
     --no-owner \
     --no-acl \
     -F c \
     -f digitalocean_backup.dump
   ```

### Option B: Export via psql (Most Reliable)

1. **Connect from your Contabo server:**
   ```bash
   psql "postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
   ```

2. **Export schema only:**
   ```bash
   pg_dump \
     -h rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com \
     -p 25060 \
     -U doadmin \
     -d defaultdb \
     --schema-only \
     --no-owner \
     --no-acl \
     -f schema.sql
   ```

3. **Export data only:**
   ```bash
   pg_dump \
     -h rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com \
     -p 25060 \
     -U doadmin \
     -d defaultdb \
     --data-only \
     --no-owner \
     --no-acl \
     -f data.sql
   ```

4. **Export everything (recommended):**
   ```bash
   pg_dump \
     -h rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com \
     -p 25060 \
     -U doadmin \
     -d defaultdb \
     --no-owner \
     --no-acl \
     --clean \
     --if-exists \
     -f complete_backup.sql
   ```

## Step 3: Import to Contabo

### Option A: Using Adminer (Web UI)

1. **Upload SQL file to Contabo server:**
   ```bash
   # Upload complete_backup.sql to your Contabo server
   scp complete_backup.sql user@your-contabo-server:/tmp/
   ```

2. **In Adminer:**
   - Go to Adminer → Your Contabo DB
   - Click "Import"
   - If file > 2MB, split it first (see Option B)

3. **Or use command line:**
   ```bash
   # On Contabo server
   psql "postgresql://postgres:x70wIAAISfu4pqmo@localhost:5432/postgres" < complete_backup.sql
   ```

### Option B: Split Large Files for Adminer

If your export is > 2MB, split it:

```bash
# Split SQL file into 1.5MB chunks
split -b 1500k complete_backup.sql part_

# This creates: part_aa, part_ab, part_ac, etc.
# Upload each to Adminer → Import → Execute in order
```

## Step 4: Quick Verification Commands

### From DigitalOcean Dashboard (SQL Editor):

```sql
-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Count records per table
SELECT 
  'SELECT ''' || table_name || ''' as table_name, COUNT(*) as count FROM ' || table_name || ' UNION ALL'
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check specific table structure (e.g., players)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'players'
ORDER BY ordinal_position;

-- Get database size
SELECT pg_size_pretty(pg_database_size('defaultdb')) AS size;
```

## Step 5: Recommended Migration Steps

1. ✅ **Verify DigitalOcean DB** (Step 1 - you're doing this now)
2. ✅ **Export complete backup** (Step 2, Option B - recommended)
3. ✅ **Create schema on Contabo** (if not already done)
4. ✅ **Import data to Contabo** (Step 3)
5. ✅ **Verify Contabo import** (run same queries from Step 4)
6. ✅ **Update application** (change DATABASE_URL to Contabo)

## Your Connection Details

**DigitalOcean (Source):**
- Host: `rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com`
- Port: `25060`
- Database: `defaultdb`
- User: `doadmin`
- Password: `masked_password`

**Contabo (Destination):**
- Host: `localhost` or your Contabo DB IP
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: `x70wIAAISfu4pqmo`

