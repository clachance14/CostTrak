-- Migration: Disable RLS for Development
-- This migration disables all Row Level Security policies to allow unrestricted access during development
-- IMPORTANT: Re-enable RLS and policies before production deployment

-- Disable RLS on core tables (only those that definitely exist)
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.divisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.craft_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.po_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.change_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_audit_log DISABLE ROW LEVEL SECURITY;

-- Disable RLS on newer tables if they exist
ALTER TABLE IF EXISTS public.labor_actuals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.labor_running_averages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.labor_headcount_forecasts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_contract_breakdowns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies (using IF EXISTS to avoid errors)
-- This will attempt to drop common policy patterns across all tables

-- Drop policies for users/profiles table
DO $$ 
BEGIN
    -- Drop all policies on users table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'DROP POLICY IF EXISTS "authenticated_users_view_users" ON public.users';
        EXECUTE 'DROP POLICY IF EXISTS "users_update_own_profile" ON public.users';
        EXECUTE 'DROP POLICY IF EXISTS "controllers_manage_users" ON public.users';
    END IF;
    
    -- Drop all policies on profiles table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        EXECUTE 'DROP POLICY IF EXISTS "authenticated_users_view_profiles" ON public.profiles';
        EXECUTE 'DROP POLICY IF EXISTS "profiles_update_own_profile" ON public.profiles';
        EXECUTE 'DROP POLICY IF EXISTS "controllers_manage_profiles" ON public.profiles';
        EXECUTE 'DROP POLICY IF EXISTS "all_users_read_profiles" ON public.profiles';
    END IF;
END $$;

-- Add a comment to track this is development mode
COMMENT ON SCHEMA public IS 'RLS DISABLED FOR DEVELOPMENT - Re-enable before production';