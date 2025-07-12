-- Manual User Creation Process for clachance@ics.ac
-- Use this if the automated scripts fail

-- STEP 1: Create Auth User in Supabase Dashboard
-- ================================================
-- 1. Go to: https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/auth/users
-- 2. Click "Add user" → "Create new user"
-- 3. Enter:
--    - Email: clachance@ics.ac
--    - Password: TempPassword123!
--    - Auto Confirm User: Yes (checked)
-- 4. Click "Create user"

-- STEP 2: Run this SQL to create the user profile
-- ================================================
-- After creating the auth user manually, run this SQL:

INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  role,
  is_active,
  title,
  created_at,
  updated_at
)
SELECT 
  id,
  'clachance@ics.ac',
  'C',
  'Lachance',
  'controller',
  true,
  'System Administrator',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'clachance@ics.ac'
ON CONFLICT (id) DO UPDATE SET
  role = 'controller',
  is_active = true,
  updated_at = NOW();

-- Verify the user was created
SELECT 
  u.id,
  u.email,
  u.first_name || ' ' || u.last_name as full_name,
  u.role,
  u.title,
  u.is_active
FROM public.users u
WHERE u.email = 'clachance@ics.ac';

-- If successful, you should see:
-- email: clachance@ics.ac
-- full_name: C Lachance  
-- role: controller
-- title: System Administrator
-- is_active: true