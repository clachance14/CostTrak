-- Check current profiles table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table = 'users';

-- Check auth.users columns
SELECT 
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'auth' 
AND table_name = 'users'
AND column_name LIKE '%sign_in%';