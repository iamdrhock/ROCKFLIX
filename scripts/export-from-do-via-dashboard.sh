#!/bin/bash

# Export from DigitalOcean Database
# Run this script from your Contabo server (which has access to DigitalOcean)

set -e

# DigitalOcean connection details
DO_HOST="rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com"
DO_PORT="25060"
DO_USER="doadmin"
DO_DB="defaultdb"
DO_PASSWORD="masked_password"

# Output file
OUTPUT_FILE="digitalocean_complete_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "📦 Exporting from DigitalOcean PostgreSQL..."
echo "=========================================="
echo "Host: $DO_HOST"
echo "Port: $DO_PORT"
echo "Database: $DO_DB"
echo "Output: $OUTPUT_FILE"
echo ""

# Export everything
export PGPASSWORD="$DO_PASSWORD"

echo "🔄 Starting export..."

pg_dump \
  -h "$DO_HOST" \
  -p "$DO_PORT" \
  -U "$DO_USER" \
  -d "$DO_DB" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose \
  > "$OUTPUT_FILE"

# Check if export succeeded
if [ $? -eq 0 ]; then
  FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo ""
  echo "✅ Export completed successfully!"
  echo "   File: $OUTPUT_FILE"
  echo "   Size: $FILE_SIZE"
  echo ""
  echo "📊 Next steps:"
  echo "   1. Upload this file to your Contabo server"
  echo "   2. Import using Adminer or psql"
  echo "   3. Verify the import"
else
  echo ""
  echo "❌ Export failed!"
  exit 1
fi

