-- Add email column to profiles table for username/password login
alter table public.profiles add column if not exists email text;

-- Create index on email for faster lookups
create index if not exists profiles_email_idx on public.profiles(email);
