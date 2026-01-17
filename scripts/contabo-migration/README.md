# Database Migration: DigitalOcean → Contabo PostgreSQL

## Quick Answer: How Fast & Easy?

### ✅ **Very Fast & Easy** - Estimated Time: **2-4 hours** (depending on data size)

### **Migration Methods (Easiest to Hardest):**

1. **Using Admin Panel + Adminer (EASIEST)** ⭐ Recommended
   - Time: 2-3 hours
   - Risk: Low
   - Steps: Export via admin panel → Import via Adminer
   - **Zero downtime** if done correctly

2. **Using Adminer Only**
   - Time: 3-4 hours
   - Risk: Medium
   - Steps: Export via Adminer → Import via Adminer
   - Requires manual SQL execution

3. **Using pg_dump + psql (FASTEST)**
   - Time: 1-2 hours
   - Risk: Low
   - Steps: Export via pg_dump → Import via psql
   - Requires SSH access to server

---

## Zero Downtime Migration Strategy

### Phase 1: Preparation (30 minutes)
- ✅ Export database from DigitalOcean
- ✅ Create schema on Contabo
- ✅ Test connection

### Phase 2: Data Migration (1-3 hours)
- ✅ Import data to Contabo
- ✅ Verify data integrity
- ✅ Fix sequences

### Phase 3: Switchover (5 minutes) ⚠️ Brief Downtime
- ✅ Update environment variables
- ✅ Restart application
- ✅ Verify site is working

### Phase 4: Verification (15 minutes)
- ✅ Test all features
- ✅ Monitor for issues
- ✅ Keep DigitalOcean as backup for 7 days

**Total Estimated Downtime: 5 minutes** (only during switchover)

---

## Step-by-Step: Easiest Method (Admin Panel + Adminer)

### Step 1: Export Database (15-30 minutes)

**Option A: Using Admin Panel** (Recommended)
1. Log into admin panel: `https://rockflix.tv/arike`
2. Go to **Migrate Database** page
3. Click **Export Database**
4. Wait for export to complete
5. Click **Download Export File**
6. Save the JSON file locally

**Option B: Using Adminer on Contabo**
1. Log into Adminer on Contabo
2. Connect to DigitalOcean database:
   - **Server:** `rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com`
   - **Username:** `doadmin`
   - **Password:** `[Your DigitalOcean Password]`
   - **Database:** `defaultdb`
   - **Port:** `25060`
   - **SSL:** `require`
3. Go to **Export** tab
4. Select **SQL** format
5. Click **Export**
6. Save the SQL file

---

### Step 2: Create Schema on Contabo (15 minutes)

1. Log into Adminer on Contabo
2. Connect to your Contabo database:
   - **Server:** `[Your Contabo Database Host]`
   - **Username:** `[Your Contabo Username]`
   - **Password:** `[Your Contabo Password]`
   - **Database:** `[Your Contabo Database Name]`
   - **Port:** `[Your Contabo Port]` (usually 5432)

3. Go to **SQL command** in Adminer
4. Run the schema creation script (see `create-schema-contabo.sql`)
   - This creates all tables, indexes, and constraints
   - It will NOT delete existing data if tables already exist

**Note:** If you don't have the schema script, you can:
- Export schema from DigitalOcean using Adminer's **Export** feature (Structure only)
- Import the schema to Contabo

---

### Step 3: Import Data to Contabo (1-3 hours)

**Option A: Using Admin Panel** (Recommended)
1. Log into admin panel: `https://rockflix.tv/arike`
2. Go to **Migrate Database** page
3. Make sure you have the export file from Step 1
4. Click **Import to Contabo**
5. Wait for import to complete
6. Check import stats

**Option B: Using Adminer**
1. In Adminer, go to **Import** tab
2. Select the SQL dump file from Step 1
3. Click **Execute**
4. Wait for import to complete

**Option C: Using Adminer SQL Command**
1. Copy the contents of `import-data-contabo.sql`
2. Paste into Adminer **SQL command** section
3. Click **Execute**

---

### Step 4: Verify Data Integrity (15 minutes)

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

-- Compare with DigitalOcean (should match)
```

See `verify-migration.sql` for complete verification queries.

---

### Step 5: Update Environment Variables (5 minutes) ⚠️ Brief Downtime

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
# Old DigitalOcean (keep as backup - comment out)
# DIGITALOCEAN_DATABASE_URL=postgresql://doadmin:[PASSWORD]@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require

# New Contabo (activate)
CONTABO_DATABASE_URL=postgresql://[USER]:[PASSWORD]@[CONTABO_HOST]:[PORT]/[DATABASE]
CONTABO_DATABASE_SSL=true

# OR if using Supabase client pattern:
NEXT_PUBLIC_SUPABASE_URL=http://[CONTABO_HOST]:[PORT]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_CONTABO_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_CONTABO_SERVICE_KEY]
```

4. Save and exit (`Ctrl+X`, then `Y`, then `Enter`)

---

### Step 6: Update Application Code (If Needed)

**If Contabo uses direct PostgreSQL (not Supabase):**

The app currently uses Supabase client. You have two options:

**Option A: Keep Supabase Client** (Easier)
- Update `lib/supabase/server.ts` to use Contabo connection string
- Contabo can work with Supabase client if you set it up correctly

**Option B: Use Direct PostgreSQL** (More Control)
- Install `pg` package: `npm install pg @types/pg`
- Create new connection file: `lib/database/contabo.ts`
- Update `lib/supabase/server.ts` to use Contabo connection

---

### Step 7: Restart Application (2 minutes)

```bash
# On your server
cd /home/runcloud/webapps/rockflix/current
npm install  # Install pg package if needed
npm run build
pm2 restart rockflix
```

---

### Step 8: Verify Site is Working (15 minutes)

Test these features:
- ✅ Homepage loads
- ✅ Movies/Series pages load
- ✅ Search works
- ✅ Watch page plays videos
- ✅ Login/Register works
- ✅ Admin panel accessible
- ✅ Import functionality works
- ✅ Comments work
- ✅ TalkFlix works

---

## Rollback Plan (If Something Goes Wrong)

**Immediate Rollback (5 minutes):**

1. Revert environment variables:
```bash
cd /home/runcloud/webapps/rockflix/current
nano .env.production
# Change back to DigitalOcean credentials
pm2 restart rockflix
```

2. Site should be back online immediately

3. Keep DigitalOcean as backup for 7 days before deleting

---

## Data Size Considerations

- **Small (< 1GB):** 1-2 hours total
- **Medium (1-10GB):** 2-4 hours total
- **Large (> 10GB):** 4-8 hours total

**Your current database size:** Check in Adminer:
```sql
SELECT 
  pg_size_pretty(pg_database_size(current_database())) AS database_size;
```

---

## Common Issues & Solutions

### Issue 1: Connection Timeout
**Solution:** Increase timeout in Adminer or use pg_dump instead

### Issue 2: Foreign Key Violations
**Solution:** Import tables in correct order (see `import-order.txt`)

### Issue 3: Sequence Errors
**Solution:** Run sequence fix queries after import (see `fix-sequences.sql`)

### Issue 4: Missing Data
**Solution:** Verify export file contains all tables, re-export if needed

### Issue 5: Import Too Slow
**Solution:** Use pg_dump + psql instead of Adminer for faster import

---

## Pre-Migration Checklist

- [ ] Backup DigitalOcean database (export via Adminer or admin panel)
- [ ] Contabo database created and running
- [ ] Adminer installed on Contabo
- [ ] Contabo database credentials ready
- [ ] Test connection to Contabo database
- [ ] Schema creation script ready
- [ ] Rollback plan prepared
- [ ] Scheduled during low-traffic period (optional)

---

## Post-Migration Checklist

- [ ] All tables created successfully
- [ ] All data imported (verify counts match DigitalOcean)
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
- [ ] DigitalOcean kept as backup for 7 days

---

## Need Help?

If you encounter issues:
1. Check error logs: `pm2 logs rockflix`
2. Verify database connection in Adminer
3. Check environment variables
4. Verify Contabo database is accessible
5. Check firewall rules on Contabo
6. Review migration guide: `scripts/contabo-migration/migrate-to-contabo.md`

---

## Estimated Total Time

- **Preparation:** 30 minutes
- **Export:** 15-30 minutes
- **Schema Creation:** 15 minutes
- **Import:** 1-3 hours (depending on data size)
- **Verification:** 15 minutes
- **Switchover:** 5 minutes
- **Testing:** 15 minutes

**Total: 2-4 hours** (with 5 minutes downtime during switchover)

---

## Risk Assessment

- **Risk Level:** Low to Medium
- **Downtime:** 5 minutes (only during switchover)
- **Data Loss Risk:** Very Low (if backup is kept)
- **Rollback Time:** 5 minutes
- **Complexity:** Medium (straightforward with Adminer)

---

## Recommendation

**Use Method 1 (Admin Panel + Adminer)** for the easiest migration:
1. Export via admin panel (no technical knowledge needed)
2. Import via Adminer (visual interface, easy to use)
3. Update environment variables
4. Restart application
5. Done!

This method is:
- ✅ Fast (2-3 hours)
- ✅ Easy (no command line needed)
- ✅ Safe (can rollback easily)
- ✅ Visual (see progress in Adminer)
- ✅ Reliable (Adminer is battle-tested)

