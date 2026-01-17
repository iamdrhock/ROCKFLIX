#!/bin/bash
# Quick Migration Script: DigitalOcean → Contabo PostgreSQL
# This script automates the migration process

set -e  # Exit on error

echo "🚀 Starting Database Migration: DigitalOcean → Contabo"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
EXPORT_FILE="${BACKUP_DIR}/digitalocean_export_${TIMESTAMP}.sql"

# Check if required commands are available
command -v pg_dump >/dev/null 2>&1 || { echo -e "${RED}Error: pg_dump is not installed.${NC}" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo -e "${RED}Error: psql is not installed.${NC}" >&2; exit 1; }

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Step 1: Export from DigitalOcean
echo -e "\n${YELLOW}Step 1: Exporting database from DigitalOcean...${NC}"
read -p "Enter DigitalOcean database connection string: " DO_DATABASE_URL

if [ -z "$DO_DATABASE_URL" ]; then
    echo -e "${RED}Error: DigitalOcean database URL is required${NC}"
    exit 1
fi

echo "Exporting database..."
pg_dump "$DO_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --verbose \
  > "${EXPORT_FILE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Export completed: ${EXPORT_FILE}${NC}"
    EXPORT_SIZE=$(du -h "${EXPORT_FILE}" | cut -f1)
    echo "  File size: ${EXPORT_SIZE}"
else
    echo -e "${RED}✗ Export failed${NC}"
    exit 1
fi

# Step 2: Import to Contabo
echo -e "\n${YELLOW}Step 2: Importing database to Contabo...${NC}"
read -p "Enter Contabo database connection string: " CONTABO_DATABASE_URL

if [ -z "$CONTABO_DATABASE_URL" ]; then
    echo -e "${RED}Error: Contabo database URL is required${NC}"
    exit 1
fi

echo "Testing connection to Contabo..."
psql "$CONTABO_DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Connection to Contabo successful${NC}"
else
    echo -e "${RED}✗ Connection to Contabo failed${NC}"
    exit 1
fi

echo "Importing database..."
psql "$CONTABO_DATABASE_URL" < "${EXPORT_FILE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Import completed${NC}"
else
    echo -e "${RED}✗ Import failed${NC}"
    exit 1
fi

# Step 3: Verify Migration
echo -e "\n${YELLOW}Step 3: Verifying migration...${NC}"

echo "Counting records in Contabo..."
CONTABO_COUNTS=$(psql "$CONTABO_DATABASE_URL" -t -c "
  SELECT 'movies', COUNT(*) FROM movies
  UNION ALL SELECT 'genres', COUNT(*) FROM genres
  UNION ALL SELECT 'actors', COUNT(*) FROM actors
  UNION ALL SELECT 'seasons', COUNT(*) FROM seasons
  UNION ALL SELECT 'episodes', COUNT(*) FROM episodes;
")

echo "Counting records in DigitalOcean..."
DO_COUNTS=$(psql "$DO_DATABASE_URL" -t -c "
  SELECT 'movies', COUNT(*) FROM movies
  UNION ALL SELECT 'genres', COUNT(*) FROM genres
  UNION ALL SELECT 'actors', COUNT(*) FROM actors
  UNION ALL SELECT 'seasons', COUNT(*) FROM seasons
  UNION ALL SELECT 'episodes', COUNT(*) FROM episodes;
")

echo -e "\n${GREEN}Record counts:${NC}"
echo "$CONTABO_COUNTS"

# Step 4: Fix Sequences
echo -e "\n${YELLOW}Step 4: Fixing sequences...${NC}"

psql "$CONTABO_DATABASE_URL" <<EOF
SELECT setval('movies_id_seq', (SELECT MAX(id) FROM movies));
SELECT setval('genres_id_seq', (SELECT MAX(id) FROM genres));
SELECT setval('actors_id_seq', (SELECT MAX(id) FROM actors));
SELECT setval('seasons_id_seq', (SELECT MAX(id) FROM seasons));
SELECT setval('episodes_id_seq', (SELECT MAX(id) FROM episodes));
SELECT setval('comments_id_seq', (SELECT MAX(id) FROM comments));
SELECT setval('posts_id_seq', (SELECT MAX(id) FROM posts));
SELECT setval('profiles_id_seq', (SELECT MAX(id) FROM profiles));
EOF

echo -e "${GREEN}✓ Sequences fixed${NC}"

# Step 5: Summary
echo -e "\n${GREEN}=================================================="
echo "Migration Complete!"
echo "==================================================${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Update environment variables on your server"
echo "2. Update .env.production with Contabo connection string"
echo "3. Restart your application: pm2 restart rockflix"
echo "4. Verify site is working: https://rockflix.tv"
echo "5. Keep DigitalOcean as backup for 7 days"
echo -e "\n${YELLOW}Backup file saved: ${EXPORT_FILE}${NC}"
echo -e "\n${YELLOW}To rollback, update .env.production with DigitalOcean connection string${NC}"

