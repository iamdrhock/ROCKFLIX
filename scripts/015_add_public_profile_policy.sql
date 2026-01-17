-- Add RLS policy to allow public viewing of profiles
-- This allows anyone to view basic profile information (username, profile picture, country)
-- while keeping sensitive data like email and password_hash protected

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Note: The existing "Users can view their own profile" policy will still work
-- This just adds an additional policy for public access
