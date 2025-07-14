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
            SELECT 1 FROM public.profiles u
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
                    SELECT 1 FROM public.profiles
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
                    SELECT 1 FROM public.profiles u
                    WHERE u.id = auth.uid()
                    AND (
                        u.role IN ('controller', 'executive') OR
                        (u.role = 'ops_manager' AND u.division_id = financial_snapshots.division_id)
                    )
                )
            WHEN snapshot_type = 'company' THEN
                EXISTS (
                    SELECT 1 FROM public.profiles
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
            SELECT 1 FROM public.profiles
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
    FROM public.profiles
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