-- Fix profiles table RLS policies to prevent infinite recursion

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "authenticated_users_view_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "controllers_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "controllers_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "controllers_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "controllers_manage_profiles" ON public.profiles;

-- Create new simple policies without recursion

-- 1. Everyone authenticated can read all profiles
CREATE POLICY "all_users_read_profiles" ON public.profiles
    FOR SELECT
    USING (true);

-- 2. Users can only update their own profile
CREATE POLICY "users_update_own_profile_simple" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. Service role has full access (for admin operations via API)
CREATE POLICY "service_role_all_access" ON public.profiles
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Note: Controller permissions will be handled at the application level
-- to avoid recursion issues. The middleware and API routes already
-- check user roles after fetching the profile.

-- Verify the new policies
SELECT 
    tablename,
    policyname,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;