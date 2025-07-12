-- Simple fix for profiles RLS - temporarily disable RLS to allow access

-- Option 1: Completely disable RLS on profiles table (for development)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- This allows all authenticated users to read/write profiles without restrictions
-- Use this for development and testing

-- To re-enable RLS later with proper policies, run:
/*
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple policies without recursion:
CREATE POLICY "anyone_can_read_profiles" ON public.profiles
    FOR SELECT
    USING (true);

CREATE POLICY "users_update_own_profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "service_role_all_access" ON public.profiles
    FOR ALL
    USING (auth.role() = 'service_role');
*/