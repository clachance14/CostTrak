-- Migration: Drop functions that reference project_divisions
-- Date: 2025-08-05
-- Description: Remove any remaining functions that reference the dropped project_divisions table

-- Drop the function that's causing the error
DROP FUNCTION IF EXISTS auto_assign_division_from_user() CASCADE;

-- Drop any triggers that might be using this function
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Find and drop all triggers that might reference division-related functions
    FOR r IN 
        SELECT DISTINCT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        AND (action_statement LIKE '%division%' OR action_statement LIKE '%project_divisions%')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.trigger_name, r.event_object_table);
    END LOOP;
END $$;

-- Drop any other division-related functions that might exist
DROP FUNCTION IF EXISTS get_user_division(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_user_division_access(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS assign_project_division(uuid, uuid) CASCADE;

-- Add comment explaining the removal
COMMENT ON TABLE change_orders IS 'Change orders table - division_id column is deprecated and not used';