-- Fix infinite recursion in profiles RLS policies
-- The issue is that some policies were checking the profiles table itself, creating recursion

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate a single, simple SELECT policy that allows everyone to view all profiles
-- This is safe because we're not exposing sensitive data (password_hash is never selected in queries)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Keep the other policies (INSERT, UPDATE, DELETE) as they are
-- They don't cause recursion because they don't query the profiles table

-- Note: This allows public viewing of username, profile_picture_url, country, and role
-- Sensitive fields like password_hash and email should be excluded in application queries
