-- EMERGENCY FIX: Remove the problematic trigger that's blocking logins
-- Run this immediately to restore login functionality

-- Drop the trigger and function that's causing the error
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users CASCADE;
DROP FUNCTION IF EXISTS update_last_login() CASCADE;
DROP FUNCTION IF EXISTS update_profile_last_login() CASCADE;

-- Ensure profiles table has necessary columns (safe to run multiple times)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;

-- For now, we'll skip the automatic last_login tracking to ensure logins work
-- You can add it back later with proper testing

COMMENT ON TABLE profiles IS 'User profiles with login tracking - trigger temporarily disabled for stability';