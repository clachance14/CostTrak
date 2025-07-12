-- CostTrak Database Schema
-- Combined migrations file generated on 2025-07-12T17:26:56.618Z
-- Run this file in Supabase SQL Editor to create all tables

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- Migration: 00001_initial_schema.sql
-- ============================================================================

-- Create foundation tables that don't depend on other tables

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
-- Migration: 00002_users_and_auth.sql
-- ============================================================================

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
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00002_users_and_auth')
ON CONFLICT (version) DO NOTHING;


-- ============================================================================
-- Migration: 00003_core_business_tables.sql
-- ============================================================================

-- Create project status enum
CREATE TYPE project_status AS ENUM ('planning', 'active', 'completed', 'on_hold', 'cancelled');

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    division_id UUID NOT NULL REFERENCES public.divisions(id),
    client_id UUID REFERENCES public.clients(id),
    project_manager_id UUID REFERENCES public.users(id),
    original_contract DECIMAL(15, 2) DEFAULT 0,
    revised_contract DECIMAL(15, 2) DEFAULT 0,
    status project_status DEFAULT 'planning',
    start_date DATE NOT NULL,
    end_date DATE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    description TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create change order status enum
CREATE TYPE change_order_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled');

-- Create change orders table
CREATE TABLE IF NOT EXISTS public.change_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    co_number VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status change_order_status DEFAULT 'draft',
    reason TEXT,
    submitted_date DATE,
    approved_date DATE,
    approved_by UUID REFERENCES public.users(id),
    rejection_reason TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_co_number_per_project UNIQUE (project_id, co_number)
);

-- Create audit log table for general entity tracking
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    changes JSONB DEFAULT '{}',
    performed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create financial snapshots table
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('project', 'division', 'company')),
    snapshot_date TIMESTAMPTZ NOT NULL,
    project_id UUID REFERENCES public.projects(id),
    division_id UUID REFERENCES public.divisions(id),
    original_contract DECIMAL(15, 2),
    approved_change_orders DECIMAL(15, 2),
    revised_contract DECIMAL(15, 2),
    total_po_committed DECIMAL(15, 2),
    total_labor_cost DECIMAL(15, 2),
    total_other_cost DECIMAL(15, 2),
    total_committed DECIMAL(15, 2),
    forecasted_cost DECIMAL(15, 2),
    forecasted_profit DECIMAL(15, 2),
    profit_margin DECIMAL(5, 2),
    cost_to_complete DECIMAL(15, 2),
    percent_complete DECIMAL(5, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_snapshot_refs CHECK (
        (snapshot_type = 'project' AND project_id IS NOT NULL) OR
        (snapshot_type = 'division' AND division_id IS NOT NULL) OR
        (snapshot_type = 'company')
    )
);

-- Create indexes
CREATE INDEX idx_projects_job_number ON public.projects(job_number);
CREATE INDEX idx_projects_division ON public.projects(division_id);
CREATE INDEX idx_projects_client ON public.projects(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_projects_manager ON public.projects(project_manager_id) WHERE project_manager_id IS NOT NULL;
CREATE INDEX idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_dates ON public.projects(start_date, end_date) WHERE deleted_at IS NULL;

CREATE INDEX idx_change_orders_project ON public.change_orders(project_id);
CREATE INDEX idx_change_orders_status ON public.change_orders(status);
CREATE INDEX idx_change_orders_co_number ON public.change_orders(co_number);

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(performed_by);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

CREATE INDEX idx_financial_snapshots_type ON public.financial_snapshots(snapshot_type);
CREATE INDEX idx_financial_snapshots_project ON public.financial_snapshots(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_financial_snapshots_division ON public.financial_snapshots(division_id) WHERE division_id IS NOT NULL;
CREATE INDEX idx_financial_snapshots_date ON public.financial_snapshots(snapshot_date DESC);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
-- Controllers and executives can see all projects
CREATE POLICY "controllers_executives_view_all_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('controller', 'executive')
        )
    );

-- Ops managers can see projects in their division
CREATE POLICY "ops_managers_view_division_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'ops_manager'
            AND users.division_id = projects.division_id
        )
    );

-- Project managers can see their projects
CREATE POLICY "project_managers_view_own_projects" ON public.projects
    FOR SELECT
    USING (project_manager_id = auth.uid());

-- Accounting can view all projects
CREATE POLICY "accounting_view_all_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'accounting'
        )
    );

-- Controllers can create/update/delete projects
CREATE POLICY "controllers_manage_projects" ON public.projects
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'controller'
        )
    );

-- RLS Policies for change_orders (inherit project access)
CREATE POLICY "users_view_change_orders" ON public.change_orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = change_orders.project_id
        )
    );

-- Controllers and ops managers can manage change orders
CREATE POLICY "controllers_ops_manage_change_orders" ON public.change_orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            LEFT JOIN public.projects p ON p.id = change_orders.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id)
            )
        )
    );

-- RLS Policies for audit_log
-- Users can view audit logs for entities they have access to
CREATE POLICY "users_view_relevant_audit_logs" ON public.audit_log
    FOR SELECT
    USING (
        CASE 
            WHEN entity_type = 'project' THEN
                EXISTS (SELECT 1 FROM public.projects WHERE id = entity_id)
            WHEN entity_type = 'change_order' THEN
                EXISTS (SELECT 1 FROM public.change_orders WHERE id = entity_id)
            ELSE
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = auth.uid()
                    AND role IN ('controller', 'executive')
                )
        END
    );

-- RLS Policies for financial_snapshots
-- Same access as projects
CREATE POLICY "users_view_financial_snapshots" ON public.financial_snapshots
    FOR SELECT
    USING (
        CASE
            WHEN snapshot_type = 'project' THEN
                EXISTS (SELECT 1 FROM public.projects WHERE id = project_id)
            WHEN snapshot_type = 'division' THEN
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND (
                        u.role IN ('controller', 'executive') OR
                        (u.role = 'ops_manager' AND u.division_id = financial_snapshots.division_id)
                    )
                )
            WHEN snapshot_type = 'company' THEN
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = auth.uid()
                    AND role IN ('controller', 'executive')
                )
            ELSE false
        END
    );

-- Controllers can create financial snapshots
CREATE POLICY "controllers_create_financial_snapshots" ON public.financial_snapshots
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'controller'
        )
    );

-- Create triggers
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_change_orders_updated_at
    BEFORE UPDATE ON public.change_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update revised contract when change orders are approved
CREATE OR REPLACE FUNCTION public.update_project_revised_contract()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        UPDATE public.projects
        SET revised_contract = original_contract + (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.change_orders
            WHERE project_id = NEW.project_id
            AND status = 'approved'
        )
        WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_revised_contract_on_co_approval
    AFTER UPDATE ON public.change_orders
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
    EXECUTE FUNCTION public.update_project_revised_contract();

-- Function to check user project access
CREATE OR REPLACE FUNCTION public.user_has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role user_role;
    v_user_division UUID;
    v_project_division UUID;
    v_project_manager UUID;
BEGIN
    -- Get user info
    SELECT role, division_id INTO v_user_role, v_user_division
    FROM public.users
    WHERE id = auth.uid();
    
    -- Get project info
    SELECT division_id, project_manager_id INTO v_project_division, v_project_manager
    FROM public.projects
    WHERE id = p_project_id;
    
    -- Check access based on role
    RETURN CASE
        WHEN v_user_role IN ('controller', 'executive', 'accounting') THEN true
        WHEN v_user_role = 'ops_manager' AND v_user_division = v_project_division THEN true
        WHEN v_user_role = 'project_manager' AND auth.uid() = v_project_manager THEN true
        ELSE false
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.user_has_project_access TO authenticated;
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00003_core_business_tables')
ON CONFLICT (version) DO NOTHING;


-- ============================================================================
-- Migration: 00004_purchase_orders.sql
-- ============================================================================

-- Create purchase order status enum
CREATE TYPE po_status AS ENUM ('draft', 'submitted', 'approved', 'cancelled', 'completed');

-- Create purchase orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    po_number VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    description TEXT,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status po_status DEFAULT 'draft',
    order_date DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Import tracking fields
    legacy_po_number VARCHAR(100),
    import_batch_id VARCHAR(100),
    imported_at TIMESTAMPTZ,
    imported_by UUID REFERENCES public.users(id),
    
    -- Forecast fields
    forecast_amount DECIMAL(15, 2),
    forecast_date DATE,
    forecast_notes TEXT,
    
    -- Invoice tracking
    invoiced_amount DECIMAL(15, 2) DEFAULT 0,
    invoice_percentage DECIMAL(5, 2) DEFAULT 0,
    last_invoice_date DATE,
    
    created_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_po_number_per_project UNIQUE (project_id, po_number)
);

-- Create purchase order line items table
CREATE TABLE IF NOT EXISTS public.po_line_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_of_measure VARCHAR(50),
    unit_price DECIMAL(15, 4),
    total_amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_line_per_po UNIQUE (purchase_order_id, line_number)
);

-- Create indexes
CREATE INDEX idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_vendor ON public.purchase_orders(vendor_name);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_legacy ON public.purchase_orders(legacy_po_number) WHERE legacy_po_number IS NOT NULL;
CREATE INDEX idx_purchase_orders_import_batch ON public.purchase_orders(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX idx_purchase_orders_dates ON public.purchase_orders(order_date, expected_delivery_date);

CREATE INDEX idx_po_line_items_purchase_order ON public.po_line_items(purchase_order_id);
CREATE INDEX idx_po_line_items_category ON public.po_line_items(category) WHERE category IS NOT NULL;

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders (inherit project access)
CREATE POLICY "users_view_purchase_orders" ON public.purchase_orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = purchase_orders.project_id
        )
    );

-- Controllers and ops managers can manage purchase orders
CREATE POLICY "controllers_ops_manage_purchase_orders" ON public.purchase_orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            LEFT JOIN public.projects p ON p.id = purchase_orders.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id)
            )
        )
    );

-- Project managers can create and update their project's POs
CREATE POLICY "project_managers_manage_own_pos" ON public.purchase_orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = purchase_orders.project_id
            AND projects.project_manager_id = auth.uid()
        )
    );

-- RLS Policies for po_line_items (inherit PO access)
CREATE POLICY "users_view_po_line_items" ON public.po_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders
            WHERE purchase_orders.id = po_line_items.purchase_order_id
        )
    );

CREATE POLICY "users_manage_po_line_items" ON public.po_line_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders po
            JOIN public.projects p ON p.id = po.project_id
            JOIN public.users u ON u.id = auth.uid()
            WHERE po.id = po_line_items.purchase_order_id
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

-- Create triggers
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_line_items_updated_at
    BEFORE UPDATE ON public.po_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update PO total from line items
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.purchase_orders
    SET total_amount = (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.po_line_items
        WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
    )
    WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO total when line items change
CREATE TRIGGER update_po_total_on_line_change
    AFTER INSERT OR UPDATE OR DELETE ON public.po_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_po_total_amount();

-- Function to calculate invoice percentage
CREATE OR REPLACE FUNCTION public.update_po_invoice_percentage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_amount > 0 THEN
        NEW.invoice_percentage = (NEW.invoiced_amount / NEW.total_amount) * 100;
    ELSE
        NEW.invoice_percentage = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice percentage on INSERT
CREATE TRIGGER calculate_invoice_percentage_insert
    BEFORE INSERT ON public.purchase_orders
    FOR EACH ROW
    WHEN (NEW.invoiced_amount IS NOT NULL OR NEW.total_amount IS NOT NULL)
    EXECUTE FUNCTION public.update_po_invoice_percentage();

-- Trigger to update invoice percentage on UPDATE
CREATE TRIGGER calculate_invoice_percentage_update
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    WHEN (NEW.invoiced_amount IS DISTINCT FROM OLD.invoiced_amount OR 
          NEW.total_amount IS DISTINCT FROM OLD.total_amount)
    EXECUTE FUNCTION public.update_po_invoice_percentage();

-- Function to check PO approval limits
CREATE OR REPLACE FUNCTION public.check_po_approval_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role user_role;
    v_approval_limit DECIMAL(15, 2);
BEGIN
    -- Get approver role
    SELECT role INTO v_user_role
    FROM public.users
    WHERE id = NEW.approved_by;
    
    -- Set approval limits by role
    v_approval_limit := CASE v_user_role
        WHEN 'controller' THEN 999999999.99  -- No limit
        WHEN 'ops_manager' THEN 100000.00    -- $100k limit
        WHEN 'project_manager' THEN 25000.00 -- $25k limit
        ELSE 0
    END;
    
    -- Check if user can approve this amount
    IF NEW.total_amount > v_approval_limit THEN
        RAISE EXCEPTION 'User does not have authority to approve PO of this amount';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check approval limits
CREATE TRIGGER check_po_approval
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.approved_by IS NOT NULL)
    EXECUTE FUNCTION public.check_po_approval_limit();
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00004_purchase_orders')
ON CONFLICT (version) DO NOTHING;


-- ============================================================================
-- Migration: 00005_labor_management.sql
-- ============================================================================

-- Create labor actuals table (weekly actual costs and hours)
CREATE TABLE IF NOT EXISTS public.labor_actuals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    craft_type_id UUID NOT NULL REFERENCES public.craft_types(id),
    week_ending DATE NOT NULL,
    total_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    headcount INTEGER DEFAULT 0,
    overtime_hours DECIMAL(10, 2) DEFAULT 0,
    rate_per_hour DECIMAL(10, 2) GENERATED ALWAYS AS (
        CASE WHEN total_hours > 0 THEN total_cost / total_hours ELSE 0 END
    ) STORED,
    notes TEXT,
    entered_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_labor_actual_per_week UNIQUE (project_id, craft_type_id, week_ending),
    CONSTRAINT positive_hours CHECK (total_hours >= 0),
    CONSTRAINT positive_cost CHECK (total_cost >= 0)
);

-- Create labor running averages table
CREATE TABLE IF NOT EXISTS public.labor_running_averages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    craft_type_id UUID NOT NULL REFERENCES public.craft_types(id),
    avg_rate DECIMAL(10, 2) NOT NULL,
    total_hours DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    weeks_included INTEGER NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_avg_per_project_craft UNIQUE (project_id, craft_type_id)
);

-- Create labor headcount forecasts table
CREATE TABLE IF NOT EXISTS public.labor_headcount_forecasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    craft_type_id UUID NOT NULL REFERENCES public.craft_types(id),
    week_starting DATE NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 0,
    weekly_hours DECIMAL(10, 2) DEFAULT 40,
    forecast_rate DECIMAL(10, 2),
    forecast_cost DECIMAL(15, 2) GENERATED ALWAYS AS (
        headcount * weekly_hours * COALESCE(forecast_rate, 0)
    ) STORED,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_forecast_per_week UNIQUE (project_id, craft_type_id, week_starting),
    CONSTRAINT positive_headcount CHECK (headcount >= 0),
    CONSTRAINT positive_weekly_hours CHECK (weekly_hours >= 0 AND weekly_hours <= 168)
);

-- Create indexes
CREATE INDEX idx_labor_actuals_project ON public.labor_actuals(project_id);
CREATE INDEX idx_labor_actuals_craft ON public.labor_actuals(craft_type_id);
CREATE INDEX idx_labor_actuals_week ON public.labor_actuals(week_ending DESC);
CREATE INDEX idx_labor_actuals_project_week ON public.labor_actuals(project_id, week_ending DESC);

CREATE INDEX idx_labor_running_averages_project ON public.labor_running_averages(project_id);
CREATE INDEX idx_labor_running_averages_craft ON public.labor_running_averages(craft_type_id);

CREATE INDEX idx_labor_headcount_forecasts_project ON public.labor_headcount_forecasts(project_id);
CREATE INDEX idx_labor_headcount_forecasts_craft ON public.labor_headcount_forecasts(craft_type_id);
CREATE INDEX idx_labor_headcount_forecasts_week ON public.labor_headcount_forecasts(week_starting);
CREATE INDEX idx_labor_headcount_forecasts_project_week ON public.labor_headcount_forecasts(project_id, week_starting);

-- Enable RLS
ALTER TABLE public.labor_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_running_averages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_headcount_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for labor tables (inherit project access)
CREATE POLICY "users_view_labor_actuals" ON public.labor_actuals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = labor_actuals.project_id
        )
    );

CREATE POLICY "authorized_users_manage_labor_actuals" ON public.labor_actuals
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            LEFT JOIN public.projects p ON p.id = labor_actuals.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role IN ('controller', 'accounting') OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

CREATE POLICY "users_view_labor_running_averages" ON public.labor_running_averages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = labor_running_averages.project_id
        )
    );

CREATE POLICY "users_view_labor_headcount_forecasts" ON public.labor_headcount_forecasts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = labor_headcount_forecasts.project_id
        )
    );

CREATE POLICY "authorized_users_manage_labor_forecasts" ON public.labor_headcount_forecasts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            LEFT JOIN public.projects p ON p.id = labor_headcount_forecasts.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

-- Create triggers
CREATE TRIGGER update_labor_actuals_updated_at
    BEFORE UPDATE ON public.labor_actuals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_running_averages_updated_at
    BEFORE UPDATE ON public.labor_running_averages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_headcount_forecasts_updated_at
    BEFORE UPDATE ON public.labor_headcount_forecasts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update running averages
CREATE OR REPLACE FUNCTION public.update_labor_running_average(
    p_project_id UUID,
    p_craft_type_id UUID
) RETURNS void AS $$
DECLARE
    v_avg_rate DECIMAL(10, 2);
    v_total_hours DECIMAL(12, 2);
    v_total_cost DECIMAL(15, 2);
    v_weeks_included INTEGER;
BEGIN
    -- Calculate aggregates for last 8 weeks
    SELECT 
        AVG(rate_per_hour),
        SUM(total_hours),
        SUM(total_cost),
        COUNT(*)
    INTO v_avg_rate, v_total_hours, v_total_cost, v_weeks_included
    FROM public.labor_actuals
    WHERE project_id = p_project_id
    AND craft_type_id = p_craft_type_id
    AND week_ending >= CURRENT_DATE - INTERVAL '8 weeks'
    AND total_hours > 0;
    
    -- Insert or update running average
    INSERT INTO public.labor_running_averages (
        project_id,
        craft_type_id,
        avg_rate,
        total_hours,
        total_cost,
        weeks_included,
        last_updated
    ) VALUES (
        p_project_id,
        p_craft_type_id,
        COALESCE(v_avg_rate, 0),
        COALESCE(v_total_hours, 0),
        COALESCE(v_total_cost, 0),
        COALESCE(v_weeks_included, 0),
        NOW()
    )
    ON CONFLICT (project_id, craft_type_id) DO UPDATE SET
        avg_rate = EXCLUDED.avg_rate,
        total_hours = EXCLUDED.total_hours,
        total_cost = EXCLUDED.total_cost,
        weeks_included = EXCLUDED.weeks_included,
        last_updated = EXCLUDED.last_updated,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update running averages when actuals change
CREATE OR REPLACE FUNCTION public.trigger_update_running_average()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.update_labor_running_average(
        COALESCE(NEW.project_id, OLD.project_id),
        COALESCE(NEW.craft_type_id, OLD.craft_type_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_running_avg_on_actual_change
    AFTER INSERT OR UPDATE OR DELETE ON public.labor_actuals
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_running_average();

-- Function to calculate labor forecast variance
CREATE OR REPLACE FUNCTION public.calculate_labor_variance(
    p_project_id UUID,
    p_week_ending DATE
) RETURNS TABLE (
    craft_type_id UUID,
    craft_type_name VARCHAR,
    actual_hours DECIMAL,
    actual_cost DECIMAL,
    forecast_hours DECIMAL,
    forecast_cost DECIMAL,
    hours_variance DECIMAL,
    cost_variance DECIMAL,
    variance_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id,
        ct.name,
        COALESCE(la.total_hours, 0),
        COALESCE(la.total_cost, 0),
        COALESCE(lf.weekly_hours * lf.headcount, 0),
        COALESCE(lf.forecast_cost, 0),
        COALESCE(la.total_hours, 0) - COALESCE(lf.weekly_hours * lf.headcount, 0),
        COALESCE(la.total_cost, 0) - COALESCE(lf.forecast_cost, 0),
        CASE 
            WHEN COALESCE(lf.forecast_cost, 0) > 0 
            THEN ((COALESCE(la.total_cost, 0) - COALESCE(lf.forecast_cost, 0)) / lf.forecast_cost) * 100
            ELSE 0
        END
    FROM public.craft_types ct
    LEFT JOIN public.labor_actuals la ON 
        la.craft_type_id = ct.id AND 
        la.project_id = p_project_id AND 
        la.week_ending = p_week_ending
    LEFT JOIN public.labor_headcount_forecasts lf ON 
        lf.craft_type_id = ct.id AND 
        lf.project_id = p_project_id AND 
        lf.week_starting = p_week_ending - INTERVAL '6 days'
    WHERE (la.id IS NOT NULL OR lf.id IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_labor_running_average TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_labor_variance TO authenticated;
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00005_labor_management')
ON CONFLICT (version) DO NOTHING;


-- ============================================================================
-- Migration: 00006_documents.sql
-- ============================================================================

-- Create documents table for file management
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('project', 'purchase_order', 'change_order')),
    entity_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (category IN ('contract', 'invoice', 'drawing', 'report', 'other')),
    uploaded_by UUID NOT NULL REFERENCES public.users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_category ON public.documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Controllers and executives can see all documents
CREATE POLICY "controllers_executives_view_all_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('controller', 'executive')
        )
    );

-- Ops managers can see documents for their division's projects
CREATE POLICY "ops_managers_view_division_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.projects p ON p.division_id = u.division_id
            WHERE u.id = auth.uid()
            AND u.role = 'ops_manager'
            AND (
                (documents.entity_type = 'project' AND documents.entity_id = p.id)
                OR (documents.entity_type = 'purchase_order' AND EXISTS (
                    SELECT 1 FROM public.purchase_orders po
                    WHERE po.id = documents.entity_id AND po.project_id = p.id
                ))
                OR (documents.entity_type = 'change_order' AND EXISTS (
                    SELECT 1 FROM public.change_orders co
                    WHERE co.id = documents.entity_id AND co.project_id = p.id
                ))
            )
        )
    );

-- Project managers can see documents for their projects
CREATE POLICY "project_managers_view_project_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.projects p ON p.project_manager_id = u.id
            WHERE u.id = auth.uid()
            AND u.role = 'project_manager'
            AND (
                (documents.entity_type = 'project' AND documents.entity_id = p.id)
                OR (documents.entity_type = 'purchase_order' AND EXISTS (
                    SELECT 1 FROM public.purchase_orders po
                    WHERE po.id = documents.entity_id AND po.project_id = p.id
                ))
                OR (documents.entity_type = 'change_order' AND EXISTS (
                    SELECT 1 FROM public.change_orders co
                    WHERE co.id = documents.entity_id AND co.project_id = p.id
                ))
            )
        )
    );

-- Accounting can see financial documents
CREATE POLICY "accounting_view_financial_documents" ON public.documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'accounting'
        )
        AND documents.category IN ('invoice', 'contract', 'report')
    );

-- Users can upload documents based on their permissions
CREATE POLICY "users_can_upload_documents" ON public.documents
    FOR INSERT
    WITH CHECK (
        -- User must be authenticated
        auth.uid() = uploaded_by
        AND (
            -- Controllers and executives can upload to any entity
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid()
                AND users.role IN ('controller', 'executive')
            )
            OR
            -- Ops managers can upload to their division's projects
            EXISTS (
                SELECT 1 FROM public.users u
                JOIN public.projects p ON p.division_id = u.division_id
                WHERE u.id = auth.uid()
                AND u.role = 'ops_manager'
                AND (
                    (entity_type = 'project' AND entity_id = p.id)
                    OR (entity_type = 'purchase_order' AND EXISTS (
                        SELECT 1 FROM public.purchase_orders po
                        WHERE po.id = entity_id AND po.project_id = p.id
                    ))
                    OR (entity_type = 'change_order' AND EXISTS (
                        SELECT 1 FROM public.change_orders co
                        WHERE co.id = entity_id AND co.project_id = p.id
                    ))
                )
            )
            OR
            -- Project managers can upload to their projects
            EXISTS (
                SELECT 1 FROM public.users u
                JOIN public.projects p ON p.project_manager_id = u.id
                WHERE u.id = auth.uid()
                AND u.role = 'project_manager'
                AND (
                    (entity_type = 'project' AND entity_id = p.id)
                    OR (entity_type = 'purchase_order' AND EXISTS (
                        SELECT 1 FROM public.purchase_orders po
                        WHERE po.id = entity_id AND po.project_id = p.id
                    ))
                    OR (entity_type = 'change_order' AND EXISTS (
                        SELECT 1 FROM public.change_orders co
                        WHERE co.id = entity_id AND co.project_id = p.id
                    ))
                )
            )
        )
    );

-- Only controllers can delete documents (soft delete)
CREATE POLICY "controllers_can_delete_documents" ON public.documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'controller'
        )
    )
    WITH CHECK (
        -- Only allow updating deleted_at field
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'controller'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_documents_updated_at();

-- Create storage bucket for documents (this would be done via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false);
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00006_documents')
ON CONFLICT (version) DO NOTHING;


-- ============================================================================
-- Migration: 00007_notifications_enhanced.sql
-- ============================================================================

-- Enhance notifications table with additional fields
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium' 
  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50) 
  CHECK (related_entity_type IN ('project', 'purchase_order', 'change_order', 'labor_forecast', 'financial_snapshot', 'user', 'system')),
ADD COLUMN IF NOT EXISTS related_entity_id UUID,
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.notifications(user_id, is_read) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_priority 
  ON public.notifications(priority) 
  WHERE is_read = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_related_entity 
  ON public.notifications(related_entity_type, related_entity_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_expires 
  ON public.notifications(expires_at) 
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- Create notification categories enum type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'change_order_created',
      'change_order_updated', 
      'po_import_complete',
      'po_threshold_exceeded',
      'labor_variance_alert',
      'labor_entry_reminder',
      'project_deadline_approaching',
      'project_status_changed',
      'budget_threshold_alert',
      'financial_snapshot_ready',
      'user_assigned_project',
      'user_role_changed',
      'document_uploaded',
      'system_announcement',
      'data_quality_issue'
    );
  END IF;
END $$;

-- Add type column if it doesn't exist
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS type notification_type;

-- RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;

-- Users can only view their own notifications
CREATE POLICY "users_view_own_notifications" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "users_delete_own_notifications" ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type notification_type,
    p_priority VARCHAR DEFAULT 'medium',
    p_related_entity_type VARCHAR DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        priority,
        related_entity_type,
        related_entity_id,
        action_url,
        expires_at,
        metadata
    ) VALUES (
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_priority,
        p_related_entity_type,
        p_related_entity_id,
        p_action_url,
        p_expires_at,
        p_metadata
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
    p_notification_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = true,
        updated_at = NOW()
    WHERE id = ANY(p_notification_ids)
    AND user_id = auth.uid()
    AND is_read = false
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.notifications
        WHERE user_id = auth.uid()
        AND is_read = false
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired notifications (to be called by a scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET deleted_at = NOW()
    WHERE expires_at < NOW()
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count TO authenticated;
-- Record migration
INSERT INTO public.schema_migrations (version) 
VALUES ('00007_notifications_enhanced')
ON CONFLICT (version) DO NOTHING;

