-- Create admin user clachance@ics.ac with controller role
-- This version handles missing unique constraints

DO $$
DECLARE
  user_id uuid;
  user_exists boolean;
BEGIN
  -- Check if user already exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'clachance@ics.ac') INTO user_exists;
  
  IF user_exists THEN
    -- Get existing user ID
    SELECT id INTO user_id FROM auth.users WHERE email = 'clachance@ics.ac' LIMIT 1;
    RAISE NOTICE 'Auth user already exists with ID: %', user_id;
  ELSE
    -- Generate new user ID
    user_id := gen_random_uuid();
    
    -- Create new auth user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      'clachance@ics.ac',
      crypt('TempPassword123!', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created new auth user with ID: %', user_id;
    RAISE NOTICE 'Password: TempPassword123! (change on first login)';
  END IF;
  
  -- Check if profile exists
  IF EXISTS(SELECT 1 FROM public.users WHERE id = user_id) THEN
    -- Update existing profile to controller
    UPDATE public.users 
    SET 
      role = 'controller',
      is_active = true,
      updated_at = NOW()
    WHERE id = user_id;
    
    RAISE NOTICE 'Updated existing profile to controller role';
  ELSE
    -- Create new profile
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
    );
    
    RAISE NOTICE 'Created new profile with controller role';
  END IF;
  
END $$;

-- Verify the user
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