-- Row Level Security Policies for ROCKFLIX
-- Run this script to secure your database tables
-- NOTE: Test thoroughly in development before applying to production!

-- Enable RLS on all tables
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MOVIES TABLE POLICIES
-- ============================================

-- Anyone can view published movies
CREATE POLICY "Public can view movies"
ON movies FOR SELECT
USING (true);

-- Only admins can insert movies
CREATE POLICY "Admins can insert movies"
ON movies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Only admins can update movies
CREATE POLICY "Admins can update movies"
ON movies FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Only admins can delete movies
CREATE POLICY "Admins can delete movies"
ON movies FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can view public profiles
CREATE POLICY "Public can view user profiles"
ON users FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Only admins can delete users
CREATE POLICY "Admins can delete users"
ON users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ============================================
-- POSTS TABLE POLICIES (TalkFlix)
-- ============================================

-- Anyone can view posts
CREATE POLICY "Public can view posts"
ON posts FOR SELECT
USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
ON posts FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own posts, admins can delete any
CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ============================================
-- COMMENTS TABLE POLICIES
-- ============================================

-- Anyone can view comments
CREATE POLICY "Public can view comments"
ON comments FOR SELECT
USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
ON comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON comments FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete own comments"
ON comments FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ============================================
-- REACTIONS TABLE POLICIES
-- ============================================

-- Anyone can view reactions
CREATE POLICY "Public can view reactions"
ON reactions FOR SELECT
USING (true);

-- Authenticated users can create reactions
CREATE POLICY "Authenticated users can create reactions"
ON reactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
ON reactions FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- DOWNLOAD LINKS TABLE POLICIES
-- ============================================

-- Anyone can view download links
CREATE POLICY "Public can view download links"
ON download_links FOR SELECT
USING (true);

-- Only admins can manage download links
CREATE POLICY "Admins can insert download links"
ON download_links FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update download links"
ON download_links FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can delete download links"
ON download_links FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ============================================
-- SITE SETTINGS TABLE POLICIES
-- ============================================

-- Anyone can view site settings
CREATE POLICY "Public can view site settings"
ON site_settings FOR SELECT
USING (true);

-- Only admins can update site settings
CREATE POLICY "Admins can update settings"
ON site_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- ============================================
-- APPLY SAME PATTERN TO OTHER TABLES
-- ============================================

-- For genres, actors, tags, etc. - follow same pattern:
-- 1. Public SELECT
-- 2. Admin only INSERT, UPDATE, DELETE
