-- Check all triggers on change_orders table
SELECT 
    tgname as trigger_name,
    tgtype,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'change_orders'::regclass
  AND NOT t.tgisinternal;

-- Also check the source of those trigger functions
SELECT 
    p.proname as function_name,
    p.prosrc as function_source
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'change_orders'::regclass
  AND NOT t.tgisinternal;