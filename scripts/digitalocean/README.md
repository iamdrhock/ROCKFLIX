# DigitalOcean PostgreSQL Migration Guide

## Overview
This guide will help you migrate your RockFlix database from Supabase to DigitalOcean PostgreSQL.

## Prerequisites
- DigitalOcean PostgreSQL database created and running
- Connection details ready
- Python 3 installed (for data export script)

## Migration Steps

### Step 1: Create Database Schema on DigitalOcean

Connect to your DigitalOcean database using any PostgreSQL client (psql, pgAdmin, DBeaver, etc.):

\`\`\`bash
psql "postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
\`\`\`

Then run the schema creation script:

\`\`\`bash
\i scripts/digitalocean/01-create-schema.sql
\`\`\`

Or copy the contents and execute directly.

### Step 2: Export Data from Supabase

Run the Python export script:

\`\`\`bash
cd scripts/digitalocean
pip install psycopg2-binary
python 02-export-supabase-data.py
\`\`\`

This will create `03-import-data.sql` with all your data.

### Step 3: Import Data to DigitalOcean

Run the import script on DigitalOcean:

\`\`\`bash
\i scripts/digitalocean/03-import-data.sql
\`\`\`

### Step 4: Test Connection in v0

Visit this URL in your browser (while v0 preview is running):

\`\`\`
http://localhost:3000/api/test-digitalocean
\`\`\`

You should see a success response with table count.

### Step 5: Update Application Code (Optional)

The app is currently using Supabase client. If you want to switch entirely to DigitalOcean:

1. Replace Supabase imports with direct SQL queries using `lib/db/digitalocean.ts`
2. Update all API routes to use the new connection
3. Test thoroughly before deploying

## Connection Details

**DigitalOcean PostgreSQL:**
- Host: rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com
- Port: 25060
- Database: defaultdb
- Username: doadmin
- Password: masked_password
- SSL Mode: require

**Connection String:**
\`\`\`
postgresql://doadmin:masked_password@rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com:25060/defaultdb?sslmode=require
\`\`\`

## For VPS Deployment

When you're ready to deploy to your VPS, use the same connection details above. Your VPS application should connect to this DigitalOcean database directly.

## Troubleshooting

### Connection Issues
- Ensure your IP is whitelisted in DigitalOcean database settings
- Check firewall settings allow port 25060
- Verify SSL mode is set to "require"

### Import Errors
- Make sure schema is created before importing data
- Check for foreign key constraint issues
- Verify all required extensions are installed

## Notes
- Keep Supabase running while testing DigitalOcean
- Once confident, you can disconnect Supabase
- The same DigitalOcean database works for both v0 and your VPS
