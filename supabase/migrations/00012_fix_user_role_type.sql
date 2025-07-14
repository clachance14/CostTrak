-- Fix missing user_role type
-- This migration ensures the user_role type exists in the database

-- Check if user_role type exists, create if not
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'controller',
            'executive',
            'ops_manager',
            'project_manager',
            'accounting',
            'viewer'
        );
    END IF;
END $$;

-- Ensure profiles table has the correct role column
DO $$ 
BEGIN
    -- Check if the role column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'role'
    ) THEN
        -- Add the role column if it doesn't exist
        ALTER TABLE profiles ADD COLUMN role user_role NOT NULL DEFAULT 'viewer';
    ELSE
        -- If it exists but has wrong type, we need to handle the conversion
        -- First check if it's already the correct type
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'role' 
            AND udt_name = 'user_role'
        ) THEN
            -- Create a temporary column
            ALTER TABLE profiles ADD COLUMN role_temp user_role;
            
            -- Copy and convert data
            UPDATE profiles 
            SET role_temp = CASE 
                WHEN role::text = 'controller' THEN 'controller'::user_role
                WHEN role::text = 'executive' THEN 'executive'::user_role
                WHEN role::text = 'ops_manager' THEN 'ops_manager'::user_role
                WHEN role::text = 'project_manager' THEN 'project_manager'::user_role
                WHEN role::text = 'accounting' THEN 'accounting'::user_role
                ELSE 'viewer'::user_role
            END;
            
            -- Drop the old column and rename the new one
            ALTER TABLE profiles DROP COLUMN role;
            ALTER TABLE profiles RENAME COLUMN role_temp TO role;
            ALTER TABLE profiles ALTER COLUMN role SET NOT NULL;
            ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'viewer';
        END IF;
    END IF;
END $$;

-- Ensure the check constraint exists for email domain
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'profiles' 
        AND constraint_name = 'profiles_email_domain_check'
    ) THEN
        ALTER TABLE profiles 
        ADD CONSTRAINT profiles_email_domain_check 
        CHECK (email LIKE '%@ics.ac');
    END IF;
END $$;