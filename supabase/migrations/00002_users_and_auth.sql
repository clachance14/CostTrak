-- Create user roles enum
CREATE TYPE user_role AS ENUM ('controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer');

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    division_id UUID REFERENCES public.divisions(id),
    is_active BOOLEAN DEFAULT true,
    phone VARCHAR(50),
    title VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_email_domain CHECK (email LIKE '%@ics.ac')
);

-- Create auth audit log table
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    event_type VARCHAR(50) NOT NULL,
    event_details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notifications table (base structure, will be enhanced in migration 00007)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_division ON public.users(division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_users_active ON public.users(is_active);
CREATE INDEX idx_auth_audit_log_user ON public.auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_event ON public.auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_log_created ON public.auth_audit_log(created_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
-- All authenticated users can view other users
CREATE POLICY "authenticated_users_view_users" ON public.users
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own_profile" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Can only update certain fields
        role = (SELECT role FROM public.users WHERE id = auth.uid()) AND
        email = (SELECT email FROM public.users WHERE id = auth.uid())
    );

-- Controllers can create and update users
CREATE POLICY "controllers_manage_users" ON public.users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- RLS Policies for auth_audit_log
-- Users can view their own audit logs
CREATE POLICY "users_view_own_auth_logs" ON public.auth_audit_log
    FOR SELECT
    USING (auth.uid() = user_id);

-- Controllers can view all audit logs
CREATE POLICY "controllers_view_all_auth_logs" ON public.auth_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'controller'
        )
    );

-- RLS Policies for notifications (basic, will be enhanced later)
CREATE POLICY "users_view_own_notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create a new user (called after Supabase auth signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, first_name, last_name, role)
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

-- Trigger to create user record on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to log authentication events
CREATE OR REPLACE FUNCTION public.log_auth_event(
    p_user_id UUID,
    p_event_type VARCHAR,
    p_event_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.auth_audit_log (
        user_id,
        event_type,
        event_details,
        ip_address,
        user_agent,
        success,
        error_message
    ) VALUES (
        p_user_id,
        p_event_type,
        p_event_details,
        p_ip_address,
        p_user_agent,
        p_success,
        p_error_message
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM public.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_auth_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role TO authenticated;