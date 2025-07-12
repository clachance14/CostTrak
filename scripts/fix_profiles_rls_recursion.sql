-- Fix infinite recursion in profiles table RLS policies

-- Step 1: Disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "authenticated_users_view_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "controllers_manage_profiles" ON public.profiles;

-- Step 3: Recreate policies without circular references

-- Policy: All authenticated users can view all profiles
CREATE POLICY "authenticated_users_view_profiles" ON public.profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Users can update their own profile (simplified without self-reference)
CREATE POLICY "profiles_update_own_profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Controllers can insert new profiles
CREATE POLICY "controllers_insert_profiles" ON public.profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- Policy: Controllers can update any profile
CREATE POLICY "controllers_update_profiles" ON public.profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- Policy: Controllers can delete profiles
CREATE POLICY "controllers_delete_profiles" ON public.profiles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- Step 4: Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;