-- Consolidated Migration Script for ICS PO Import
-- This script includes all necessary migrations with corrected table references
-- Execute this entire script in the Supabase Dashboard SQL Editor
-- 
-- IMPORTANT: This is a one-time migration script. 
-- Do not run it multiple times as it will fail on duplicate policies.
-- If you need to re-run, first drop existing policies or use individual migration files.

-- ============================================================================
-- STEP 1: Core Business Tables (from 00003_core_business_tables.sql)
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
    project_manager_id UUID REFERENCES public.profiles(id),
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
    created_by UUID REFERENCES public.profiles(id),
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
    approved_by UUID REFERENCES public.profiles(id),
    rejection_reason TEXT,
    created_by UUID REFERENCES public.profiles(id),
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
    performed_by UUID REFERENCES public.profiles(id),
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

-- ============================================================================
-- STEP 2: Purchase Orders Tables (from 00004_purchase_orders.sql)
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
    imported_by UUID REFERENCES public.profiles(id),
    
    -- Forecast fields
    forecast_amount DECIMAL(15, 2),
    forecast_date DATE,
    forecast_notes TEXT,
    
    -- Invoice tracking
    invoiced_amount DECIMAL(15, 2) DEFAULT 0,
    invoice_percentage DECIMAL(5, 2) DEFAULT 0,
    last_invoice_date DATE,
    
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
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

-- ============================================================================
-- STEP 3: ICS Enhancement (from 00008_enhance_purchase_orders_for_ics.sql)
-- ============================================================================

-- Add missing fields to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS requestor VARCHAR(255),
ADD COLUMN IF NOT EXISTS sub_cost_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS contract_extra_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS cost_center VARCHAR(10),
ADD COLUMN IF NOT EXISTS sub_cc VARCHAR(10),
ADD COLUMN IF NOT EXISTS subsub_cc VARCHAR(10),
ADD COLUMN IF NOT EXISTS generation_date DATE,
ADD COLUMN IF NOT EXISTS fto_sent_date DATE,
ADD COLUMN IF NOT EXISTS fto_return_date DATE,
ADD COLUMN IF NOT EXISTS bb_date DATE,
ADD COLUMN IF NOT EXISTS wo_pmo VARCHAR(100);

-- Add missing fields to po_line_items table
ALTER TABLE public.po_line_items
ADD COLUMN IF NOT EXISTS invoice_ticket VARCHAR(100),
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS material_description TEXT,
ADD COLUMN IF NOT EXISTS contract_extra_type VARCHAR(20);

-- ============================================================================
-- STEP 4: Create Indexes
-- ============================================================================

-- Core business table indexes
CREATE INDEX IF NOT EXISTS idx_projects_job_number ON public.projects(job_number);
CREATE INDEX IF NOT EXISTS idx_projects_division ON public.projects(division_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_manager ON public.projects(project_manager_id) WHERE project_manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_dates ON public.projects(start_date, end_date) WHERE deleted_at IS NULL;

-- Purchase order indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON public.purchase_orders(vendor_name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_legacy ON public.purchase_orders(legacy_po_number) WHERE legacy_po_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_import_batch ON public.purchase_orders(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_dates ON public.purchase_orders(order_date, expected_delivery_date);

-- ICS-specific indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requestor ON public.purchase_orders(requestor) WHERE requestor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sub_cost_code ON public.purchase_orders(sub_cost_code) WHERE sub_cost_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_contract_extra ON public.purchase_orders(contract_extra_type) WHERE contract_extra_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cost_center ON public.purchase_orders(cost_center) WHERE cost_center IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_generation_date ON public.purchase_orders(generation_date) WHERE generation_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_line_items_purchase_order ON public.po_line_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_category ON public.po_line_items(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_line_items_invoice_ticket ON public.po_line_items(invoice_ticket) WHERE invoice_ticket IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_line_items_invoice_date ON public.po_line_items(invoice_date) WHERE invoice_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_line_items_contract_extra ON public.po_line_items(contract_extra_type) WHERE contract_extra_type IS NOT NULL;

-- ============================================================================
-- STEP 5: Add Constraints
-- ============================================================================

-- Add constraint to ensure contract_extra_type values are valid
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_purchase_orders_contract_extra_type'
    ) THEN
        ALTER TABLE public.purchase_orders 
        ADD CONSTRAINT check_purchase_orders_contract_extra_type 
        CHECK (contract_extra_type IS NULL OR contract_extra_type IN ('Contract', 'Extra', 'Overhead'));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_po_line_items_contract_extra_type'
    ) THEN
        ALTER TABLE public.po_line_items 
        ADD CONSTRAINT check_po_line_items_contract_extra_type 
        CHECK (contract_extra_type IS NULL OR contract_extra_type IN ('Contract', 'Extra', 'Overhead'));
    END IF;
END
$$;

-- ============================================================================
-- STEP 6: Enable RLS and Create Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
-- Controllers and executives can see all projects
CREATE POLICY "controllers_executives_view_all_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('controller', 'executive')
        )
    );

-- Ops managers can see projects in their division
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

-- Project managers can see their projects
CREATE POLICY "project_managers_view_own_projects" ON public.projects
    FOR SELECT
    USING (project_manager_id = auth.uid());

-- Accounting can view all projects
CREATE POLICY "accounting_view_all_projects" ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'accounting'
        )
    );

-- Controllers can create/update/delete projects
CREATE POLICY "controllers_manage_projects" ON public.projects
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'controller'
        )
    );

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
            SELECT 1 FROM public.profiles u
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
            JOIN public.profiles u ON u.id = auth.uid()
            WHERE po.id = po_line_items.purchase_order_id
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

-- ============================================================================
-- STEP 7: Create Triggers and Functions
-- ============================================================================

-- Create triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at'
    ) THEN
        CREATE TRIGGER update_projects_updated_at
            BEFORE UPDATE ON public.projects
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_purchase_orders_updated_at'
    ) THEN
        CREATE TRIGGER update_purchase_orders_updated_at
            BEFORE UPDATE ON public.purchase_orders
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_po_line_items_updated_at'
    ) THEN
        CREATE TRIGGER update_po_line_items_updated_at
            BEFORE UPDATE ON public.po_line_items
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_po_total_on_line_change'
    ) THEN
        CREATE TRIGGER update_po_total_on_line_change
            AFTER INSERT OR UPDATE OR DELETE ON public.po_line_items
            FOR EACH ROW
            EXECUTE FUNCTION public.update_po_total_amount();
    END IF;
END
$$;

-- ============================================================================
-- STEP 8: Create Test Project for ICS Import
-- ============================================================================

-- Insert a test project with job_number "5640" to match the ICS CSV data
INSERT INTO public.projects (job_number, name, division_id, start_date, description)
SELECT 
    '5640', 
    'Test Project for ICS Import', 
    d.id, 
    CURRENT_DATE,
    'Test project created for ICS PO Log CSV import functionality'
FROM public.divisions d 
WHERE d.is_active = true
LIMIT 1
ON CONFLICT (job_number) DO NOTHING;

-- Record migration completion
INSERT INTO public.schema_migrations (version) 
VALUES ('consolidated_ics_migration') 
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration completed successfully! You can now import ICS PO Log CSV files.' as result;