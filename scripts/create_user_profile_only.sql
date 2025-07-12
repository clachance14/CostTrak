-- Create profile for existing auth user clachance@ics.ac
-- Use this when the auth user already exists in Supabase

DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Get the existing auth user ID
  SELECT id INTO user_id FROM auth.users WHERE email = 'clachance@ics.ac' LIMIT 1;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User clachance@ics.ac not found in auth.users';
  END IF;
  
  -- Create or update the profile
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    division_id,
    is_active,
    title,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    'clachance@ics.ac',
    'C',
    'Lachance',
    'controller',
    NULL,
    true,
    'System Administrator',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'controller',
    is_active = true,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    updated_at = NOW();
  
  RAISE NOTICE 'Profile created/updated successfully for user ID: %', user_id;
END $$;

-- Verify the profile
SELECT 
  u.id,
  u.email,
  u.first_name || ' ' || u.last_name as full_name,
  u.role,
  u.title,
  u.is_active
FROM public.profiles u
WHERE u.email = 'clachance@ics.ac';