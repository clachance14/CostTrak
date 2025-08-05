-- Migration to clean up remaining division references after simplification
-- This removes functions and triggers that still reference the dropped project_divisions table

-- First, let's identify and drop all functions that might reference project_divisions
-- We need to be specific about function signatures

-- Drop functions with CASCADE to remove dependent objects
DROP FUNCTION IF EXISTS project_access_allowed(p_project_id uuid, p_user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS notify_project_change() CASCADE;
DROP FUNCTION IF EXISTS notify_division_change() CASCADE;
DROP FUNCTION IF EXISTS create_notification(p_type text, p_message text, p_entity_type text, p_entity_id uuid, p_metadata jsonb) CASCADE;

-- Drop any other functions that might exist with different signatures
DROP FUNCTION IF EXISTS project_access_allowed(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_notification(text, text, uuid, uuid, jsonb) CASCADE;

-- Drop any triggers on change_orders that might be calling these functions
DROP TRIGGER IF EXISTS change_order_notification_trigger ON change_orders;
DROP TRIGGER IF EXISTS change_order_audit_trigger ON change_orders;

-- Note: Cannot drop policies on project_divisions as the table no longer exists
-- These policies were already dropped when the table was dropped

-- Check if change_orders table exists and has division_id column
DO $$ 
BEGIN
    -- Only proceed if change_orders table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'change_orders') THEN
        -- Drop any remaining foreign key constraints on change_orders
        ALTER TABLE change_orders DROP CONSTRAINT IF EXISTS change_orders_division_id_fkey;
        
        -- Check if division_id column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'change_orders' AND column_name = 'division_id') THEN
            -- Make division_id nullable if it isn't already
            ALTER TABLE change_orders ALTER COLUMN division_id DROP NOT NULL;
            
            -- Add a comment explaining the column is deprecated
            COMMENT ON COLUMN change_orders.division_id IS 'Deprecated - divisions have been removed from the system';
        END IF;
    END IF;
END $$;