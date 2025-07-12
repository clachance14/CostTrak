-- Simple password reset for clachance@ics.ac
-- Run this in Supabase SQL editor

-- Update the password
UPDATE auth.users
SET encrypted_password = crypt('Password123', gen_salt('bf'))
WHERE email = 'clachance@ics.ac';

-- Verify the user exists
SELECT 
  id,
  email,
  created_at,
  CASE 
    WHEN encrypted_password IS NOT NULL THEN 'Password is set'
    ELSE 'No password'
  END as password_status
FROM auth.users 
WHERE email = 'clachance@ics.ac';