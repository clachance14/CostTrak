-- Add admin user clachance@ics.ac with controller role (unlimited permissions)
-- IMPORTANT: First create the user in Supabase Auth, then run this script

-- Option 1: Create user via Supabase Dashboard (Recommended)
-- 1. Go to Authentication > Users in Supabase Dashboard
-- 2. Click "Invite User" or "Create User"
-- 3. Enter email: clachance@ics.ac
-- 4. User will receive invite email to set password

-- Option 2: Use this complete script (creates both auth and profile)
-- This creates the auth user with a temporary password
DO $$
DECLARE
  auth_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO auth_user_id 
  FROM auth.users 
  WHERE email = 'clachance@ics.ac';

  -- If user doesn't exist in auth.users, create it
  IF auth_user_id IS NULL THEN
    auth_user_id := gen_random_uuid();
    
    -- Create minimal auth.users entry
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      confirmed_at
    ) VALUES (
      auth_user_id,
      'clachance@ics.ac',
      crypt('TempPassword123!', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object(),
      false,
      NOW()
    );
    
    RAISE NOTICE 'Auth user created with temporary password: TempPassword123!';
  ELSE
    RAISE NOTICE 'Auth user already exists';
  END IF;

  -- Create or update public.users entry with controller role
  INSERT INTO public.users (
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
    auth_user_id,
    'clachance@ics.ac',
    'C',
    'Lachance',
    'controller', -- Controller role has unlimited permissions
    NULL, -- Controllers don't need division assignment
    true,
    'System Administrator',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'controller',
    is_active = true,
    updated_at = NOW();

  RAISE NOTICE 'Admin user profile created/updated successfully';
  
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END $$;

-- Verify the user was created
SELECT 
  u.id,
  u.email,
  u.first_name || ' ' || u.last_name as full_name,
  u.role,
  u.title,
  u.is_active,
  u.created_at
FROM public.users u
WHERE u.email = 'clachance@ics.ac';