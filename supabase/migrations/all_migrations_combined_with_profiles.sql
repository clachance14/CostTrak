-- CostTrak Database Schema with profiles table
-- Updated to use 'profiles' instead of 'users' following Supabase best practices
-- Run this file in Supabase SQL Editor to create all tables

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Migration: 00001_initial_schema.sql
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create divisions table
CREATE TABLE IF NOT EXISTS public.divisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    primary_contact_name VARCHAR(200),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create craft types table for labor categories
CREATE TABLE IF NOT EXISTS public.craft_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    category VARCHAR(20) NOT NULL CHECK (category IN ('direct', 'indirect', 'staff')),
    default_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_divisions_code ON public.divisions(code) WHERE is_active = true;
CREATE INDEX idx_divisions_active ON public.divisions(is_active);
CREATE INDEX idx_clients_code ON public.clients(code) WHERE is_active = true;
CREATE INDEX idx_clients_active ON public.clients(is_active);
CREATE INDEX idx_craft_types_category ON public.craft_types(category) WHERE is_active = true;
CREATE INDEX idx_craft_types_code ON public.craft_types(code) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for divisions (all authenticated users can view)
CREATE POLICY "authenticated_users_view_divisions" ON public.divisions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for clients (all authenticated users can view)
CREATE POLICY "authenticated_users_view_clients" ON public.clients
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for craft_types (all authenticated users can view)
CREATE POLICY "authenticated_users_view_craft_types" ON public.craft_types
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_divisions_updated_at
    BEFORE UPDATE ON public.divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_craft_types_updated_at
    BEFORE UPDATE ON public.craft_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial data for divisions
INSERT INTO public.divisions (name, code) VALUES
    ('Civil', 'CIV'),
    ('Structural', 'STR'),
    ('Mechanical', 'MEC'),
    ('Electrical', 'ELE'),
    ('Industrial', 'IND'),
    ('Environmental', 'ENV')
ON CONFLICT (code) DO NOTHING;

-- Insert initial data for craft types
INSERT INTO public.craft_types (name, code, category, default_rate) VALUES
    -- Direct labor
    ('Carpenter', 'CARP', 'direct', 65.00),
    ('Electrician', 'ELEC', 'direct', 75.00),
    ('Pipefitter', 'PIPE', 'direct', 72.00),
    ('Ironworker', 'IRON', 'direct', 70.00),
    ('Equipment Operator', 'EQOP', 'direct', 68.00),
    ('Laborer', 'LABR', 'direct', 45.00),
    -- Indirect labor
    ('Foreman', 'FORM', 'indirect', 85.00),
    ('Safety', 'SAFE', 'indirect', 60.00),
    ('QC Inspector', 'QCIN', 'indirect', 65.00),
    -- Staff
    ('Project Manager', 'PMGR', 'staff', 120.00),
    ('Project Engineer', 'PENG', 'staff', 95.00),
    ('Superintendent', 'SUPT', 'staff', 110.00),
    ('Admin', 'ADMN', 'staff', 50.00)
ON CONFLICT (code) DO NOTHING;

-- Insert sample clients
INSERT INTO public.clients (name, code, city, state) VALUES
    ('Acme Corporation', 'ACME', 'Houston', 'TX'),
    ('Global Energy Partners', 'GEP', 'Dallas', 'TX'),
    ('Industrial Solutions Inc', 'ISI', 'Austin', 'TX'),
    ('Texaco Refining', 'TEX', 'Corpus Christi', 'TX'),
    ('Dow Chemical Company', 'DOW', 'Freeport', 'TX')
ON CONFLICT (code) DO NOTHING;

-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00001_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Migration: 00002_profiles_and_auth.sql
-- ============================================================================

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
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
    CONSTRAINT profiles_valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT profiles_valid_email_domain CHECK (email LIKE '%@ics.ac')
);

-- Create auth audit log table
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    event_type VARCHAR(50) NOT NULL,
    event_details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_division ON public.profiles(division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_profiles_active ON public.profiles(is_active);
CREATE INDEX idx_auth_audit_log_user ON public.auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_event ON public.auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_log_created ON public.auth_audit_log(created_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
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

-- RLS Policies for auth_audit_log
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

-- RLS Policies for notifications
CREATE POLICY "users_view_own_notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create a new profile (called after Supabase auth signup)
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

-- Trigger to create profile record on signup
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
        FROM public.profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_auth_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role TO authenticated;

-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00002_profiles_and_auth')
ON CONFLICT (version) DO NOTHING;