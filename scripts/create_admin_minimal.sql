-- Create admin user clachance@ics.ac
-- Simplified version that works with Supabase auth

DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO user_id FROM auth.users WHERE email = 'clachance@ics.ac';
  
  IF user_id IS NULL THEN
    -- Create minimal auth user with only required fields
    user_id := gen_random_uuid();
    
    BEGIN
      INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at
      ) VALUES (
        user_id,
        'clachance@ics.ac',
        crypt('TempPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
      );
      
      RAISE NOTICE 'Created auth user with temporary password: TempPassword123!';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create auth user. Error: %', SQLERRM;
      RAISE NOTICE 'Please create user manually in Supabase Dashboard > Authentication > Users';
      RETURN;
    END;
  END IF;
  
  -- Create or update profile
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    title
  ) VALUES (
    user_id,
    'clachance@ics.ac',
    'C',
    'Lachance',
    'controller',
    true,
    'System Administrator'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'controller',
    is_active = true,
    updated_at = NOW();
  
  RAISE NOTICE 'User profile created/updated successfully';
  
END $$;

-- Verify
SELECT * FROM public.users WHERE email = 'clachance@ics.ac';