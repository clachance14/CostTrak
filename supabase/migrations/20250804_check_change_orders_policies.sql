-- Check all RLS policies on change_orders table
SELECT 
    pol.polname as policy_name,
    CASE pol.polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END as command,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
WHERE pol.polrelid = 'change_orders'::regclass;

-- Also check if RLS is enabled on change_orders
SELECT relrowsecurity 
FROM pg_class 
WHERE relname = 'change_orders';