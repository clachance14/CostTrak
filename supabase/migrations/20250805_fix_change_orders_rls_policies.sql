-- Migration: Fix Change Orders RLS Policies
-- Date: 2025-08-05
-- Description: Remove any remaining references to project_divisions in change_orders RLS policies
-- Note: All users are now project_manager role only

-- First, drop all existing policies on change_orders to ensure clean slate
DROP POLICY IF EXISTS "All authenticated users can view change orders" ON change_orders;
DROP POLICY IF EXISTS "Controllers and PMs can manage change orders" ON change_orders;
DROP POLICY IF EXISTS "change_orders_authenticated_access" ON change_orders;

-- Drop any other policies that might exist with different names
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Find and drop all policies on change_orders table
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'change_orders'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON change_orders', r.policyname);
    END LOOP;
END $$;

-- Create a single, simple policy for all authenticated users (all are project_managers)
-- This matches the simplified approach where all users have full access
CREATE POLICY "project_managers_full_access" ON change_orders
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify RLS is enabled on the table
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- Add comment explaining the simplified access model
COMMENT ON POLICY "project_managers_full_access" ON change_orders IS 
'All authenticated users are project managers and have full access to change orders';