-- ============================================================================
-- ENABLE ROW LEVEL SECURITY FOR PRODUCTION
-- ============================================================================
-- This script re-enables Row Level Security (RLS) on all tables.
-- This MUST be run before deploying to production.
-- ============================================================================

-- Confirm this is intentional
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'ENABLING Row Level Security (RLS) on all tables';
  RAISE NOTICE 'This is REQUIRED for production deployment';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
END $$;

-- Function to enable RLS on all tables in public schema
DO $$
DECLARE
  table_record RECORD;
  enabled_count INTEGER := 0;
  policy_count INTEGER := 0;
BEGIN
  -- Loop through all tables in public schema
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%'
    ORDER BY tablename
  LOOP
    -- Check if RLS is currently disabled
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_class 
      WHERE relname = table_record.tablename 
      AND relrowsecurity = true
    ) THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
      RAISE NOTICE 'Enabled RLS on table: %', table_record.tablename;
      enabled_count := enabled_count + 1;
    ELSE
      RAISE NOTICE 'RLS already enabled on table: %', table_record.tablename;
    END IF;
    
    -- Count policies for this table
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = table_record.tablename;
    
    IF policy_count = 0 THEN
      RAISE WARNING 'Table % has RLS enabled but NO POLICIES defined!', table_record.tablename;
    ELSE
      RAISE NOTICE '  - Table % has % policies defined', table_record.tablename, policy_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary: Enabled RLS on % tables', enabled_count;
END $$;

-- Verify RLS status and policies
RAISE NOTICE '';
RAISE NOTICE 'RLS Status Report:';
RAISE NOTICE '==================';

SELECT 
  t.schemaname,
  t.tablename,
  CASE 
    WHEN c.relrowsecurity THEN '✓ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status,
  COUNT(p.policyname) as policy_count,
  CASE 
    WHEN c.relrowsecurity AND COUNT(p.policyname) > 0 THEN '✓ Secured'
    WHEN c.relrowsecurity AND COUNT(p.policyname) = 0 THEN '⚠️  No Policies!'
    ELSE '❌ Not Secured'
  END as security_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename NOT LIKE 'pg_%'
AND t.tablename NOT LIKE 'sql_%'
GROUP BY t.schemaname, t.tablename, c.relrowsecurity
ORDER BY 
  CASE 
    WHEN NOT c.relrowsecurity THEN 1
    WHEN c.relrowsecurity AND COUNT(p.policyname) = 0 THEN 2
    ELSE 3
  END,
  t.tablename;

-- List all policies
RAISE NOTICE '';
RAISE NOTICE 'Active RLS Policies:';
RAISE NOTICE '===================';

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has SELECT/DELETE condition'
    ELSE 'No SELECT/DELETE condition'
  END as select_condition,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has INSERT/UPDATE check'
    ELSE 'No INSERT/UPDATE check'
  END as modify_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test queries to verify RLS is working
RAISE NOTICE '';
RAISE NOTICE 'Testing RLS Policies:';
RAISE NOTICE '====================';

-- Test 1: Ensure non-controllers cannot see all projects
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- This would need to be run as a non-controller user to properly test
  -- For now, we just verify the policies exist
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' 
    AND policyname LIKE '%select%'
  ) THEN
    RAISE NOTICE 'Test 1 ✓: Projects table has SELECT policies';
  ELSE
    RAISE WARNING 'Test 1 ❌: Projects table missing SELECT policies!';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname LIKE '%select%'
  ) THEN
    RAISE NOTICE 'Test 2 ✓: Users table has SELECT policies';
  ELSE
    RAISE WARNING 'Test 2 ❌: Users table missing SELECT policies!';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
  ) THEN
    RAISE NOTICE 'Test 3 ✓: Purchase orders table has policies';
  ELSE
    RAISE WARNING 'Test 3 ❌: Purchase orders table missing policies!';
  END IF;
END $$;

-- Critical tables that MUST have RLS
DO $$
DECLARE
  critical_tables TEXT[] := ARRAY[
    'users',
    'projects', 
    'purchase_orders',
    'change_orders',
    'financial_snapshots',
    'labor_actuals',
    'labor_headcount_forecasts',
    'documents',
    'audit_log'
  ];
  table_name TEXT;
  missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH table_name IN ARRAY critical_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_class c
      JOIN pg_tables t ON t.tablename = c.relname
      WHERE t.schemaname = 'public'
      AND t.tablename = table_name
      AND c.relrowsecurity = true
    ) THEN
      missing_tables := array_append(missing_tables, table_name);
    END IF;
  END LOOP;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE WARNING '';
    RAISE WARNING '❌ CRITICAL: The following tables do not have RLS enabled:';
    FOREACH table_name IN ARRAY missing_tables
    LOOP
      RAISE WARNING '   - %', table_name;
    END LOOP;
    RAISE WARNING 'DO NOT DEPLOY TO PRODUCTION until these are fixed!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✓ All critical tables have RLS enabled';
  END IF;
END $$;

-- Log this action
INSERT INTO audit_log (
  entity_type,
  entity_id,
  action,
  changes,
  performed_by,
  created_at
) VALUES (
  'system',
  gen_random_uuid(),
  'enable_rls_production',
  jsonb_build_object(
    'script', 'enable_rls_production.sql',
    'timestamp', NOW(),
    'status', 'RLS enabled for production deployment'
  ),
  auth.uid(),
  NOW()
) ON CONFLICT DO NOTHING;

RAISE NOTICE '';
RAISE NOTICE '================================================================';
RAISE NOTICE 'RLS ACTIVATION COMPLETE';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Test all application features with different user roles';
RAISE NOTICE '2. Verify no unauthorized data access is possible';
RAISE NOTICE '3. Check application logs for any permission errors';
RAISE NOTICE '4. Run performance tests to ensure acceptable response times';
RAISE NOTICE '================================================================';