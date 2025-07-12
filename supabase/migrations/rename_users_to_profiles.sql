-- Migration to rename users table to profiles
-- This follows Supabase best practices to avoid confusion with auth.users

-- First, drop all dependent views, functions, and policies that reference users table
DROP POLICY IF EXISTS "authenticated_users_view_users" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "controllers_manage_users" ON public.users;
DROP POLICY IF EXISTS "users_view_own_auth_logs" ON public.auth_audit_log;
DROP POLICY IF EXISTS "controllers_view_all_auth_logs" ON public.auth_audit_log;
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions that reference users
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_division;
DROP INDEX IF EXISTS idx_users_active;

-- Rename the table
ALTER TABLE public.users RENAME TO profiles;

-- Rename constraints
ALTER TABLE public.profiles RENAME CONSTRAINT users_pkey TO profiles_pkey;
ALTER TABLE public.profiles RENAME CONSTRAINT users_email_key TO profiles_email_key;
ALTER TABLE public.profiles RENAME CONSTRAINT users_id_fkey TO profiles_id_fkey;
ALTER TABLE public.profiles RENAME CONSTRAINT users_division_id_fkey TO profiles_division_id_fkey;
ALTER TABLE public.profiles RENAME CONSTRAINT valid_email TO profiles_valid_email;
ALTER TABLE public.profiles RENAME CONSTRAINT valid_email_domain TO profiles_valid_email_domain;

-- Update foreign key constraints in other tables
ALTER TABLE public.auth_audit_log RENAME CONSTRAINT auth_audit_log_user_id_fkey TO auth_audit_log_user_id_fkey_profiles;
ALTER TABLE public.notifications RENAME CONSTRAINT notifications_user_id_fkey TO notifications_user_id_fkey_profiles;
ALTER TABLE public.projects RENAME CONSTRAINT projects_project_manager_id_fkey TO projects_project_manager_id_fkey_profiles;
ALTER TABLE public.projects RENAME CONSTRAINT projects_created_by_fkey TO projects_created_by_fkey_profiles;
ALTER TABLE public.change_orders RENAME CONSTRAINT change_orders_approved_by_fkey TO change_orders_approved_by_fkey_profiles;
ALTER TABLE public.change_orders RENAME CONSTRAINT change_orders_created_by_fkey TO change_orders_created_by_fkey_profiles;
ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_performed_by_fkey TO audit_log_performed_by_fkey_profiles;

-- Recreate indexes with new names
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_division ON public.profiles(division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_profiles_active ON public.profiles(is_active);

-- Recreate functions with profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'viewer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM public.profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Recreate RLS policies with profiles table
CREATE POLICY "authenticated_users_view_profiles" ON public.profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_update_own_profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
        email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "controllers_manage_profiles" ON public.profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- Update RLS policies for auth_audit_log
CREATE POLICY "users_view_own_auth_logs" ON public.auth_audit_log
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "controllers_view_all_auth_logs" ON public.auth_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- Update RLS policies for notifications
CREATE POLICY "users_view_own_notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Recreate trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Update all RLS policies that reference the users table in their definitions
-- Projects policies
DROP POLICY IF EXISTS "controllers_executives_view_all_projects" ON public.projects;
CREATE POLICY "controllers_executives_view_all_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('controller', 'executive')
        )
    );

DROP POLICY IF EXISTS "ops_managers_view_division_projects" ON public.projects;
CREATE POLICY "ops_managers_view_division_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ops_manager'
            AND profiles.division_id = projects.division_id
        )
    );

DROP POLICY IF EXISTS "project_managers_view_assigned_projects" ON public.projects;
CREATE POLICY "project_managers_view_assigned_projects" ON public.projects
    FOR SELECT
    USING (
        project_manager_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'project_manager'
        )
    );

-- Continue with other policies that reference users...
-- Note: This is a partial migration. All policies referencing 'users' table need to be updated to 'profiles'

-- Grant permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role TO authenticated;