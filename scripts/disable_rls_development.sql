-- ============================================================================
-- DISABLE ROW LEVEL SECURITY FOR DEVELOPMENT
-- ============================================================================
-- WARNING: This script disables Row Level Security (RLS) on all tables.
-- This should ONLY be used in development environments.
-- NEVER run this script in production!
-- ============================================================================

-- Confirm this is intentional
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'WARNING: Disabling Row Level Security (RLS) on all tables!';
  RAISE NOTICE 'This should only be done in DEVELOPMENT environments.';
  RAISE NOTICE 'RLS MUST be enabled in production for security.';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
END $$;

-- Function to disable RLS on all tables in public schema
DO $$
DECLARE
  table_record RECORD;
  disabled_count INTEGER := 0;
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
    -- Check if RLS is currently enabled
    IF EXISTS (
      SELECT 1 
      FROM pg_class 
      WHERE relname = table_record.tablename 
      AND relrowsecurity = true
    ) THEN
      -- Disable RLS
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_record.tablename);
      RAISE NOTICE 'Disabled RLS on table: %', table_record.tablename;
      disabled_count := disabled_count + 1;
    ELSE
      RAISE NOTICE 'RLS already disabled on table: %', table_record.tablename;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary: Disabled RLS on % tables', disabled_count;
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT REMINDERS:';
  RAISE NOTICE '1. This is for DEVELOPMENT ONLY';
  RAISE NOTICE '2. Run enable_rls_production.sql before deploying';
  RAISE NOTICE '3. Test all features with RLS enabled before production';
  RAISE NOTICE '4. Document any issues found when RLS is re-enabled';
END $$;

-- Verify RLS status
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN c.relrowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status,
  CASE 
    WHEN c.relrowsecurity THEN '❌ SECURITY RISK!'
    ELSE '✓ Disabled for Dev'
  END as status_warning
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%'
ORDER BY tablename;

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
  'disable_rls_development',
  jsonb_build_object(
    'script', 'disable_rls_development.sql',
    'timestamp', NOW(),
    'warning', 'RLS disabled for development - must be re-enabled for production'
  ),
  auth.uid(),
  NOW()
) ON CONFLICT DO NOTHING; -- Ignore if audit_log has RLS or doesn't exist