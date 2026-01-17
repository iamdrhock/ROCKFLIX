#!/bin/bash
# Phase 1 Verification Script
# This script checks if NextAuth Phase 1 setup is complete and correct

echo "=========================================="
echo "NextAuth Phase 1 Verification"
echo "=========================================="
echo ""

cd /home/runcloud/webapps/rockflix/current || exit 1

# Check 1: NextAuth packages installed
echo "1. Checking NextAuth packages..."
if npm list next-auth@beta 2>/dev/null | grep -q "next-auth@beta"; then
    echo "   ✅ next-auth@beta is installed"
else
    echo "   ❌ next-auth@beta is NOT installed"
fi

if npm list @auth/pg-adapter 2>/dev/null | grep -q "@auth/pg-adapter"; then
    echo "   ✅ @auth/pg-adapter is installed"
else
    echo "   ❌ @auth/pg-adapter is NOT installed"
fi
echo ""

# Check 2: Configuration files exist
echo "2. Checking configuration files..."
if [ -f "lib/auth/nextauth-config.ts" ]; then
    echo "   ✅ lib/auth/nextauth-config.ts exists"
    
    # Check if code is uncommented
    if grep -q "import.*NextAuth" lib/auth/nextauth-config.ts 2>/dev/null; then
        echo "   ✅ NextAuth imports are uncommented"
    else
        echo "   ⚠️  NextAuth imports may still be commented"
    fi
    
    if grep -q "PostgresAdapter" lib/auth/nextauth-config.ts 2>/dev/null; then
        echo "   ✅ PostgresAdapter is configured"
    else
        echo "   ⚠️  PostgresAdapter may still be commented"
    fi
else
    echo "   ❌ lib/auth/nextauth-config.ts does NOT exist"
fi

if [ -f "app/api/auth/[...nextauth]/route.ts" ]; then
    echo "   ✅ app/api/auth/[...nextauth]/route.ts exists"
    
    # Check if placeholder code is removed
    if grep -q "NextAuth not yet active" app/api/auth/\[...nextauth\]/route.ts 2>/dev/null; then
        echo "   ⚠️  Placeholder code still exists (should be removed)"
    else
        echo "   ✅ Placeholder code removed"
    fi
    
    # Check if NextAuth handler exists
    if grep -q "NextAuth" app/api/auth/\[...nextauth\]/route.ts 2>/dev/null; then
        echo "   ✅ NextAuth handler is configured"
    else
        echo "   ⚠️  NextAuth handler may not be configured"
    fi
else
    echo "   ❌ app/api/auth/[...nextauth]/route.ts does NOT exist"
fi
echo ""

# Check 3: Environment variables
echo "3. Checking environment variables..."
if grep -q "NEXTAUTH_URL" .env 2>/dev/null; then
    NEXTAUTH_URL=$(grep "^NEXTAUTH_URL=" .env | cut -d'=' -f2)
    echo "   ✅ NEXTAUTH_URL is set: $NEXTAUTH_URL"
else
    echo "   ❌ NEXTAUTH_URL is NOT set"
fi

if grep -q "NEXTAUTH_SECRET" .env 2>/dev/null; then
    NEXTAUTH_SECRET=$(grep "^NEXTAUTH_SECRET=" .env | cut -d'=' -f2)
    if [ "${#NEXTAUTH_SECRET}" -gt 20 ]; then
        echo "   ✅ NEXTAUTH_SECRET is set (length: ${#NEXTAUTH_SECRET})"
    else
        echo "   ⚠️  NEXTAUTH_SECRET seems too short"
    fi
else
    echo "   ❌ NEXTAUTH_SECRET is NOT set"
fi

if grep -q "GOOGLE_CLIENT_ID" .env 2>/dev/null; then
    GOOGLE_CLIENT_ID=$(grep "^GOOGLE_CLIENT_ID=" .env | cut -d'=' -f2)
    if [ "$GOOGLE_CLIENT_ID" != "your-google-client-id" ] && [ ! -z "$GOOGLE_CLIENT_ID" ]; then
        echo "   ✅ GOOGLE_CLIENT_ID is set"
    else
        echo "   ⚠️  GOOGLE_CLIENT_ID may not be configured"
    fi
else
    echo "   ❌ GOOGLE_CLIENT_ID is NOT set"
fi

if grep -q "GOOGLE_CLIENT_SECRET" .env 2>/dev/null; then
    GOOGLE_CLIENT_SECRET=$(grep "^GOOGLE_CLIENT_SECRET=" .env | cut -d'=' -f2)
    if [ "$GOOGLE_CLIENT_SECRET" != "your-google-client-secret" ] && [ ! -z "$GOOGLE_CLIENT_SECRET" ]; then
        echo "   ✅ GOOGLE_CLIENT_SECRET is set"
    else
        echo "   ⚠️  GOOGLE_CLIENT_SECRET may not be configured"
    fi
else
    echo "   ❌ GOOGLE_CLIENT_SECRET is NOT set"
fi
echo ""

# Check 4: Database connection (basic check)
echo "4. Checking database connection..."
if grep -q "CONTABO_DATABASE_URL\|DATABASE_URL" .env 2>/dev/null; then
    echo "   ✅ Database URL is configured"
else
    echo "   ⚠️  Database URL not found in .env"
fi
echo ""

# Check 5: Build check (syntax validation)
echo "5. Checking TypeScript syntax..."
if command -v npx >/dev/null 2>&1; then
    if npx tsc --noEmit --skipLibCheck lib/auth/nextauth-config.ts 2>/dev/null; then
        echo "   ✅ nextauth-config.ts has valid TypeScript syntax"
    else
        echo "   ⚠️  nextauth-config.ts may have syntax errors (check manually)"
    fi
    
    if npx tsc --noEmit --skipLibCheck "app/api/auth/[...nextauth]/route.ts" 2>/dev/null; then
        echo "   ✅ route.ts has valid TypeScript syntax"
    else
        echo "   ⚠️  route.ts may have syntax errors (check manually)"
    fi
else
    echo "   ⚠️  TypeScript compiler not available for syntax check"
fi
echo ""

# Check 6: Database tables (if we can connect)
echo "6. Database tables check..."
echo "   ℹ️  To verify tables, run this SQL in Adminer:"
echo "      SELECT table_name FROM information_schema.tables"
echo "      WHERE table_schema = 'public'"
echo "      AND table_name LIKE 'nextauth_%';"
echo ""
echo "   Expected tables:"
echo "   - nextauth_users"
echo "   - nextauth_accounts"
echo "   - nextauth_sessions"
echo "   - nextauth_verification_tokens"
echo ""

echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify database tables exist (using Adminer SQL query above)"
echo "2. Run: npm run build"
echo "3. Check for build errors"
echo "4. Restart: pm2 restart rockflix"
echo "5. Visit: https://rockflix.tv/api/auth/signin"
echo "   (Should show NextAuth sign-in page, not 503 error)"
echo ""

