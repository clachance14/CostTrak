-- Verify the user management setup is complete

-- 1. Check profiles table has all necessary columns
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name IN ('last_login_at', 'created_at', 'created_by', 'is_active', 'force_password_change', 'password_changed_at')
ORDER BY column_name;

-- 2. Check if password_reset_tokens table exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'password_reset_tokens'
) as password_reset_tokens_exists;

-- 3. Check if user_invites table exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_invites'
) as user_invites_exists;

-- 4. Verify no problematic triggers exist
SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%login%';

-- 5. Check current user count and roles
SELECT 
    role,
    COUNT(*) as user_count,
    COUNT(CASE WHEN last_login_at IS NOT NULL THEN 1 END) as users_who_logged_in
FROM profiles
GROUP BY role
ORDER BY role;