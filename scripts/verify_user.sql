-- Verify clachance@ics.ac user exists in both auth and profile tables

-- Check auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_app_meta_data->>'provider' as provider
FROM auth.users 
WHERE email = 'clachance@ics.ac';

-- Check public.users profile
SELECT 
  u.id,
  u.email,
  u.first_name || ' ' || u.last_name as full_name,
  u.role,
  u.title,
  u.is_active,
  u.created_at,
  d.name as division_name
FROM public.users u
LEFT JOIN public.divisions d ON u.division_id = d.id
WHERE u.email = 'clachance@ics.ac';

-- If user doesn't exist in auth.users, show count
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email = 'clachance@ics.ac') as auth_user_count,
  (SELECT COUNT(*) FROM public.users WHERE email = 'clachance@ics.ac') as profile_count;