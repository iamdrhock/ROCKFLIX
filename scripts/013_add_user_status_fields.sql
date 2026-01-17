-- Add status fields to profiles table for user management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_reason text,
ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;

-- Create index for faster queries on banned users
CREATE INDEX IF NOT EXISTS profiles_is_banned_idx ON public.profiles(is_banned);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_banned IS 'Whether the user account is banned';
COMMENT ON COLUMN public.profiles.banned_at IS 'Timestamp when the user was banned';
COMMENT ON COLUMN public.profiles.banned_reason IS 'Reason for banning the user';
COMMENT ON COLUMN public.profiles.last_login IS 'Last login timestamp for the user';
