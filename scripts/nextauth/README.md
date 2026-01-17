# NextAuth.js Migration - Phase 1 Setup

This directory contains scripts and documentation for setting up NextAuth.js alongside Supabase Auth.

## Phase 1: Setup (Current)

**Goal**: Install NextAuth.js and create database tables without affecting the live site.

### Steps:

1. **Install Dependencies**
   ```bash
   npm install next-auth@beta @auth/pg-adapter --legacy-peer-deps
   ```

2. **Create Database Tables**
   Run the SQL script to create NextAuth tables in Contabo:
   ```bash
   # Using Adminer or psql
   psql $CONTABO_DATABASE_URL -f scripts/nextauth/create-nextauth-tables.sql
   ```

3. **Add Environment Variables**
   Add these to your `.env` file:
   ```
   NEXTAUTH_URL=http://localhost:3000  # Development
   NEXTAUTH_URL=https://rockflix.tv    # Production
   NEXTAUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

4. **Verify Setup**
   - Check that tables were created: `nextauth_users`, `nextauth_accounts`, `nextauth_sessions`, `nextauth_verification_tokens`
   - Verify NextAuth route exists: `/api/auth/[...nextauth]`
   - Test locally (NextAuth won't be active yet, but structure should be in place)

### Important Notes:

- **Supabase Auth is still active** - NextAuth is just being set up in parallel
- **No user impact** - Existing authentication continues to work
- **Admin login unaffected** - Admin uses separate authentication system
- **Build may show warnings** - Expected until packages are installed

## Next Phases:

- **Phase 2**: Migrate user data from Supabase Auth to NextAuth tables
- **Phase 3**: Enable dual authentication (both systems work)
- **Phase 4**: Gradually switch components to NextAuth
- **Phase 5**: Remove Supabase Auth completely

