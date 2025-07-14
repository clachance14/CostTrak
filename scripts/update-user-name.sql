-- Script to update user name in Supabase
-- This updates both the auth.users metadata and the profiles table

-- Update Josh Roach's name (currently stored as John)
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- First, find the user ID by email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'jroach@ics.ac';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User with email jroach@ics.ac not found';
        RETURN;
    END IF;
    
    -- Update the auth.users raw_user_meta_data
    UPDATE auth.users
    SET 
        raw_user_meta_data = jsonb_set(
            jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb),
                '{first_name}',
                '"Josh"'
            ),
            '{last_name}',
            '"Roach"'
        ),
        updated_at = NOW()
    WHERE id = v_user_id;
    
    -- Update the profiles table
    UPDATE public.profiles
    SET 
        first_name = 'Josh',
        last_name = 'Roach',
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Successfully updated name to Josh Roach for user ID: %', v_user_id;
    
    -- Verify the update
    RAISE NOTICE 'Verification:';
    PERFORM 1 FROM public.profiles 
    WHERE id = v_user_id 
    AND first_name = 'Josh' 
    AND last_name = 'Roach';
    
    IF FOUND THEN
        RAISE NOTICE '✓ Profile updated correctly';
    ELSE
        RAISE NOTICE '✗ Profile update may have failed';
    END IF;
    
END $$;

-- Query to verify the changes
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.role,
    u.raw_user_meta_data->>'first_name' as auth_first_name,
    u.raw_user_meta_data->>'last_name' as auth_last_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'jroach@ics.ac';