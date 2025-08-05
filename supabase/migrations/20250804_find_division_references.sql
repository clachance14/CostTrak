-- Diagnostic query to find ALL references to project_divisions

-- Check functions
SELECT proname, prosrc 
FROM pg_proc 
WHERE prosrc LIKE '%project_divisions%';

-- Check views
SELECT viewname, definition 
FROM pg_views 
WHERE definition LIKE '%project_divisions%';

-- Check RLS policies on change_orders
SELECT polname, pg_get_expr(polqual, polrelid) as using_expr, pg_get_expr(polwithcheck, polrelid) as check_expr
FROM pg_policy 
WHERE polrelid = 'change_orders'::regclass;