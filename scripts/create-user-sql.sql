-- SQL Script to create a user in Supabase
-- This script creates both the auth user and profile entry

-- IMPORTANT: First ensure the user_role type exists by running the migration in 
-- supabase/migrations/00012_fix_user_role_type.sql

-- Variables to customize (replace these values)
-- NOTE: You'll need to generate a proper UUID and encrypted password
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'jroach@ics.ac';  -- Change this
    v_password TEXT := 'ics123';       -- Change this
    v_first_name TEXT := 'John';       -- Change this
    v_last_name TEXT := 'Roach';       -- Change this
    v_role user_role := 'ops_manager'; -- Options: controller, executive, ops_manager, project_manager, accounting, viewer
    v_division_id UUID := NULL;        -- Set this for ops_manager role (get from divisions table)
    v_encrypted_password TEXT;
BEGIN
    -- Generate a new UUID for the user
    v_user_id := gen_random_uuid();
    
    -- Encrypt the password using Supabase's crypt function
    v_encrypted_password := crypt(v_password, gen_salt('bf'));
    
    -- Step 1: Insert into auth.users
    -- Note: This is a simplified version. In production, use Supabase Admin API
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        is_sso_user,
        role
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        v_email,
        v_encrypted_password,
        NOW(), -- Auto-confirm email
        '',
        '',
        '',
        '',
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('first_name', v_first_name, 'last_name', v_last_name, 'role', v_role),
        NOW(),
        NOW(),
        false,
        'authenticated'
    );
    
    -- Step 2: The trigger should automatically create the profile, but let's ensure it exists
    INSERT INTO public.profiles (
        id,
        email,
        first_name,
        last_name,
        role,
        division_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_email,
        v_first_name,
        v_last_name,
        v_role,
        v_division_id,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        division_id = EXCLUDED.division_id,
        updated_at = NOW();
    
    RAISE NOTICE 'User created successfully: % (ID: %)', v_email, v_user_id;
END $$;

-- To add specific users, you can use this template:
-- Replace the values as needed

-- Example 1: Create jroach@ics.ac as ops_manager
/*
-- First, get the division ID if needed
SELECT id, name FROM divisions WHERE name = 'Your Division Name';

-- Then run the user creation with the division ID
DO $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_division_id UUID := 'paste-division-id-here'; -- From the query above
BEGIN
    -- Insert into auth.users
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        is_sso_user, role
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'jroach@ics.ac',
        crypt('ics123', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"first_name": "John", "last_name": "Roach", "role": "ops_manager"}'::jsonb,
        NOW(), NOW(), false, 'authenticated'
    );
    
    -- Insert into profiles
    INSERT INTO public.profiles (
        id, email, first_name, last_name, role, division_id, is_active
    ) VALUES (
        v_user_id, 'jroach@ics.ac', 'John', 'Roach', 'ops_manager', v_division_id, true
    );
    
    RAISE NOTICE 'User jroach@ics.ac created successfully with ID: %', v_user_id;
END $$;
*/

-- Alternative: If the handle_new_user trigger is not working, you can create users with this simpler approach:
-- This uses Supabase's built-in functions (if available in your instance)

-- Check if user exists first
SELECT id, email FROM auth.users WHERE email = 'jroach@ics.ac';
SELECT id, email, role FROM public.profiles WHERE email = 'jroach@ics.ac';