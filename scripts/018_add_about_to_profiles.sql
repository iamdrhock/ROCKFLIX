-- Add about column to profiles table for user bio
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS about text;

-- Create index for faster queries on about
CREATE INDEX IF NOT EXISTS profiles_about_idx ON public.profiles(about);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.about IS 'User bio or about section (max 500 characters)';
