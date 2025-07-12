-- Reset password for clachance@ics.ac
-- This updates the password directly in auth.users

DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = 'clachance@ics.ac';
  
  IF user_id IS NOT NULL THEN
    -- Update password
    UPDATE auth.users
    SET 
      encrypted_password = crypt('TempPassword123!', gen_salt('bf')),
      password_last_changed_at = NOW(),
      updated_at = NOW()
    WHERE id = user_id;
    
    RAISE NOTICE 'Password reset successfully for clachance@ics.ac';
    RAISE NOTICE 'New password: TempPassword123!';
  ELSE
    RAISE NOTICE 'User clachance@ics.ac not found!';
  END IF;
END $$;

-- Verify the update
SELECT 
  id,
  email,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_app_meta_data->>'provider' as provider
FROM auth.users 
WHERE email = 'clachance@ics.ac';