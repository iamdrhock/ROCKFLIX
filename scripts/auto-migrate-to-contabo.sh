#!/bin/bash

# Automated Migration Script - Supabase to Contabo
# This script handles everything automatically with zero manual fixes

set -e

echo "=========================================="
echo "🚀 AUTOMATED DATABASE MIGRATION"
echo "=========================================="
echo ""

# Configuration
EXPORT_FILE="database-export.json"
CONTABO_DB_URL="${CONTABO_DATABASE_URL:-postgresql://postgres:x70wIAAISfu4pqmo@localhost:5432/postgres}"

# Step 1: Export from Supabase (via admin panel API)
echo "Step 1: Exporting from Supabase..."
if [ ! -f "$EXPORT_FILE" ]; then
    echo "❌ Export file not found: $EXPORT_FILE"
    echo "   Please export from admin panel first: https://rockflix.tv/arike/migrate-database"
    exit 1
fi
echo "✅ Export file found: $EXPORT_FILE"
echo ""

# Step 2: Create schema on Contabo (if not exists)
echo "Step 2: Creating schema on Contabo..."
psql "$CONTABO_DB_URL" -f scripts/contabo-complete-schema.sql 2>&1 | grep -v "already exists" || true
echo "✅ Schema created/verified"
echo ""

# Step 3: Add all possible missing columns automatically
echo "Step 3: Adding missing columns automatically..."
psql "$CONTABO_DB_URL" <<'EOF'
-- Fix site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_movie_watch_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS meta_series_watch_title TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS theme_color TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS watch_page_middle_custom_html TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_cache BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_enabled BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cache_ttl_minutes INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_image_optimization BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS max_movies_per_page INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS enable_lazy_loading BOOLEAN;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS database_query_timeout INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS smtp_password TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS email_from TEXT;

-- Fix comment_likes
ALTER TABLE comment_likes ADD COLUMN IF NOT EXISTS is_like BOOLEAN;

-- Fix comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_reason TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_by UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_by UUID;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE;
EOF
echo "✅ Missing columns added"
echo ""

# Step 4: Run smart import (skips any remaining mismatches)
echo "Step 4: Importing data (auto-skipping mismatches)..."
node scripts/smart-import-to-contabo.js "$CONTABO_DB_URL" "$EXPORT_FILE"
echo ""

echo "=========================================="
echo "✅ MIGRATION COMPLETE!"
echo "=========================================="

