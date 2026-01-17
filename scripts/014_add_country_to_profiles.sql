-- Add country column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country text;

-- Create index for faster queries on country
CREATE INDEX IF NOT EXISTS profiles_country_idx ON public.profiles(country);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.country IS 'User country selection';
