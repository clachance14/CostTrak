-- Check for duplicate users table or view
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  c.relkind as type,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    ELSE c.relkind::text
  END as object_type,
  c.relrowsecurity as has_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'users'
AND n.nspname IN ('public', 'auth')
ORDER BY n.nspname, c.relname;

-- Specifically disable RLS on public.users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Verify the change
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN c.relrowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
WHERE t.tablename = 'users'
ORDER BY schemaname, tablename;