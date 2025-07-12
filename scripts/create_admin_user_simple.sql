-- Create admin user clachance@ics.ac with controller role
-- This script creates both auth and profile entries

-- First, create the auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at,
  confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'clachance@ics.ac',
  crypt('TempPassword123!', gen_salt('bf')),
  NOW(),
  NULL,
  '',
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  '',
  0,
  NULL,
  '',
  NULL,
  false,
  NULL,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Get the user ID
WITH auth_user AS (
  SELECT id FROM auth.users WHERE email = 'clachance@ics.ac' LIMIT 1
)
-- Create the profile
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
)
SELECT 
  id,
  'clachance@ics.ac',
  'C',
  'Lachance',
  'controller',
  NULL,
  true,
  'System Administrator',
  NOW(),
  NOW()
FROM auth_user
ON CONFLICT (id) DO UPDATE SET
  role = 'controller',
  is_active = true,
  updated_at = NOW();

-- Verify creation
SELECT 
  u.id,
  u.email,
  u.first_name || ' ' || u.last_name as full_name,
  u.role,
  u.title,
  u.is_active
FROM public.users u
WHERE u.email = 'clachance@ics.ac';