-- Aggressive cleanup of change_orders table to remove any division references

-- 1. Disable RLS on change_orders temporarily
ALTER TABLE change_orders DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies on change_orders
DO $$
DECLARE
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT polname FROM pg_policy WHERE polrelid = 'change_orders'::regclass
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON change_orders', pol_name);
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- 4. Create simple RLS policy for change_orders (all authenticated users can do everything)
CREATE POLICY "change_orders_authenticated_access" ON change_orders
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Drop any remaining functions that might be problematic
DROP FUNCTION IF EXISTS project_access_allowed CASCADE;
DROP FUNCTION IF EXISTS check_project_access CASCADE;
DROP FUNCTION IF EXISTS get_user_accessible_projects CASCADE;

-- 6. Ensure division_id is nullable and has no constraints
ALTER TABLE change_orders 
    DROP CONSTRAINT IF EXISTS change_orders_division_id_fkey CASCADE,
    ALTER COLUMN division_id DROP NOT NULL;