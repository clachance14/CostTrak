-- First, drop the problematic trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP FUNCTION IF EXISTS update_last_login();

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add missing columns to profiles table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'last_login_at') THEN
        ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'created_by') THEN
        ALTER TABLE profiles ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'is_active') THEN
        ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'password_changed_at') THEN
        ALTER TABLE profiles ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'force_password_change') THEN
        ALTER TABLE profiles ADD COLUMN force_password_change BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create a simpler, more reliable function to update last login
-- This version doesn't rely on auth.users columns that might not exist
CREATE OR REPLACE FUNCTION update_profile_last_login()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple update that just sets the timestamp
  UPDATE profiles
  SET last_login_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the login
    RAISE WARNING 'Failed to update last_login_at for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users table for tracking logins
-- Using a simpler approach that's less likely to fail
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    -- Trigger when raw_user_meta_data changes (indicates successful login)
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
    OR 
    -- Or when last_sign_in_at would change (if column exists)
    (OLD IS DISTINCT FROM NEW AND NEW.id = OLD.id)
  )
  EXECUTE FUNCTION update_profile_last_login();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- Ensure the profiles table has proper RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create or replace the basic RLS policy for profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add a comment explaining the migration
COMMENT ON FUNCTION update_profile_last_login() IS 'Updates last_login_at timestamp in profiles table when user logs in, with error handling to prevent login failures';