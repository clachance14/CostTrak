-- Migration: Add project budgets and contract breakdowns for enhanced financial tracking
-- This migration adds tables to support detailed budget planning and contract PO breakdowns

-- 1. Add superintendent field to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS superintendent_id UUID REFERENCES public.profiles(id);

-- Add index for superintendent lookup
CREATE INDEX IF NOT EXISTS idx_projects_superintendent ON public.projects(superintendent_id) WHERE superintendent_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.superintendent_id IS 'Project superintendent assignment, separate from project manager';

-- 2. Create project_budgets table for detailed budget breakdown
CREATE TABLE IF NOT EXISTS public.project_budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    
    -- Budget breakdown fields
    labor_budget DECIMAL(15, 2) DEFAULT 0 CHECK (labor_budget >= 0),
    small_tools_consumables_budget DECIMAL(15, 2) DEFAULT 0 CHECK (small_tools_consumables_budget >= 0),
    materials_budget DECIMAL(15, 2) DEFAULT 0 CHECK (materials_budget >= 0),
    equipment_budget DECIMAL(15, 2) DEFAULT 0 CHECK (equipment_budget >= 0),
    subcontracts_budget DECIMAL(15, 2) DEFAULT 0 CHECK (subcontracts_budget >= 0),
    other_budget DECIMAL(15, 2) DEFAULT 0 CHECK (other_budget >= 0),
    other_budget_description TEXT,
    
    -- Computed total budget
    total_budget DECIMAL(15, 2) GENERATED ALWAYS AS (
        COALESCE(labor_budget, 0) + 
        COALESCE(small_tools_consumables_budget, 0) + 
        COALESCE(materials_budget, 0) + 
        COALESCE(equipment_budget, 0) + 
        COALESCE(subcontracts_budget, 0) + 
        COALESCE(other_budget, 0)
    ) STORED,
    
    -- Budget status and approval
    budget_status VARCHAR(20) DEFAULT 'draft' CHECK (budget_status IN ('draft', 'submitted', 'approved', 'revised')),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    
    -- Notes and justification
    notes TEXT,
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for project_budgets
CREATE INDEX idx_project_budgets_project ON public.project_budgets(project_id);
CREATE INDEX idx_project_budgets_status ON public.project_budgets(budget_status);
CREATE INDEX idx_project_budgets_total ON public.project_budgets(total_budget);

-- Add comments for documentation
COMMENT ON TABLE public.project_budgets IS 'Detailed budget breakdown for projects';
COMMENT ON COLUMN public.project_budgets.labor_budget IS 'Budgeted amount for labor costs';
COMMENT ON COLUMN public.project_budgets.small_tools_consumables_budget IS 'Budgeted amount for small tools and consumable materials';
COMMENT ON COLUMN public.project_budgets.materials_budget IS 'Budgeted amount for materials';
COMMENT ON COLUMN public.project_budgets.equipment_budget IS 'Budgeted amount for equipment rental/purchase';
COMMENT ON COLUMN public.project_budgets.subcontracts_budget IS 'Budgeted amount for subcontractor work';
COMMENT ON COLUMN public.project_budgets.other_budget IS 'Budgeted amount for other/miscellaneous costs';
COMMENT ON COLUMN public.project_budgets.total_budget IS 'Auto-calculated total budget (sum of all budget categories)';

-- 3. Create project_contract_breakdowns table for PO breakdown
CREATE TABLE IF NOT EXISTS public.project_contract_breakdowns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    
    -- Client information
    client_po_number VARCHAR(100),
    client_representative VARCHAR(255),
    
    -- PO breakdown by type
    labor_po_amount DECIMAL(15, 2) DEFAULT 0 CHECK (labor_po_amount >= 0),
    materials_po_amount DECIMAL(15, 2) DEFAULT 0 CHECK (materials_po_amount >= 0),
    demo_po_amount DECIMAL(15, 2) DEFAULT 0 CHECK (demo_po_amount >= 0),
    
    -- Computed total (should match projects.original_contract)
    total_contract_amount DECIMAL(15, 2) GENERATED ALWAYS AS (
        COALESCE(labor_po_amount, 0) + 
        COALESCE(materials_po_amount, 0) + 
        COALESCE(demo_po_amount, 0)
    ) STORED,
    
    -- Additional contract details
    contract_date DATE,
    contract_terms TEXT,
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for project_contract_breakdowns
CREATE INDEX idx_project_contract_breakdowns_project ON public.project_contract_breakdowns(project_id);
CREATE INDEX idx_project_contract_breakdowns_po_number ON public.project_contract_breakdowns(client_po_number) WHERE client_po_number IS NOT NULL;
CREATE INDEX idx_project_contract_breakdowns_total ON public.project_contract_breakdowns(total_contract_amount);

-- Add comments for documentation
COMMENT ON TABLE public.project_contract_breakdowns IS 'Breakdown of project contracts by PO type';
COMMENT ON COLUMN public.project_contract_breakdowns.client_po_number IS 'Client purchase order number';
COMMENT ON COLUMN public.project_contract_breakdowns.client_representative IS 'Name of client representative/contact';
COMMENT ON COLUMN public.project_contract_breakdowns.labor_po_amount IS 'Contract amount for labor portion';
COMMENT ON COLUMN public.project_contract_breakdowns.materials_po_amount IS 'Contract amount for materials portion';
COMMENT ON COLUMN public.project_contract_breakdowns.demo_po_amount IS 'Contract amount for demolition portion';
COMMENT ON COLUMN public.project_contract_breakdowns.total_contract_amount IS 'Auto-calculated total contract amount (sum of all PO amounts)';

-- 4. Create update triggers for timestamp management
CREATE TRIGGER update_project_budgets_updated_at 
    BEFORE UPDATE ON public.project_budgets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_contract_breakdowns_updated_at 
    BEFORE UPDATE ON public.project_contract_breakdowns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Create audit log triggers
CREATE OR REPLACE FUNCTION log_project_budget_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (entity_type, entity_id, action, changes, performed_by)
        VALUES ('project_budget', NEW.id, 'create', to_jsonb(NEW), NEW.created_by);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_log (entity_type, entity_id, action, changes, performed_by)
        VALUES ('project_budget', NEW.id, 'update', 
                jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)), 
                NEW.created_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_project_budgets
    AFTER INSERT OR UPDATE ON public.project_budgets
    FOR EACH ROW
    EXECUTE FUNCTION log_project_budget_changes();

-- 6. Add RLS policies for project_budgets
ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;

-- Policy: Controllers and executives can view all budgets
CREATE POLICY project_budgets_view_all ON public.project_budgets
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role IN ('controller', 'executive')
        )
    );

-- Policy: Project managers can view budgets for their projects
CREATE POLICY project_budgets_view_own ON public.project_budgets
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE project_manager_id = auth.uid() 
               OR superintendent_id = auth.uid()
        )
    );

-- Policy: Controllers can create/update budgets
CREATE POLICY project_budgets_manage ON public.project_budgets
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role = 'controller'
        )
    );

-- 7. Add RLS policies for project_contract_breakdowns
ALTER TABLE public.project_contract_breakdowns ENABLE ROW LEVEL SECURITY;

-- Policy: Controllers and executives can view all contract breakdowns
CREATE POLICY project_contracts_view_all ON public.project_contract_breakdowns
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role IN ('controller', 'executive', 'accounting')
        )
    );

-- Policy: Project managers can view contracts for their projects
CREATE POLICY project_contracts_view_own ON public.project_contract_breakdowns
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE project_manager_id = auth.uid() 
               OR superintendent_id = auth.uid()
        )
    );

-- Policy: Controllers can manage contract breakdowns
CREATE POLICY project_contracts_manage ON public.project_contract_breakdowns
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role = 'controller'
        )
    );

-- 8. Create a view for project financial summary including budgets
CREATE OR REPLACE VIEW project_financial_summary AS
SELECT 
    p.id,
    p.job_number,
    p.name,
    p.original_contract,
    p.revised_contract,
    
    -- Budget data
    pb.total_budget,
    pb.labor_budget,
    pb.materials_budget,
    pb.equipment_budget,
    pb.subcontracts_budget,
    pb.small_tools_consumables_budget,
    pb.other_budget,
    
    -- Contract breakdown
    pcb.labor_po_amount,
    pcb.materials_po_amount,
    pcb.demo_po_amount,
    pcb.client_po_number,
    
    -- Calculated fields
    COALESCE(pb.total_budget, 0) - COALESCE(p.original_contract, 0) as budget_variance,
    CASE 
        WHEN COALESCE(p.original_contract, 0) > 0 
        THEN ((COALESCE(p.original_contract, 0) - COALESCE(pb.total_budget, 0)) / p.original_contract * 100)
        ELSE 0 
    END as estimated_margin_percent
    
FROM public.projects p
LEFT JOIN public.project_budgets pb ON pb.project_id = p.id
LEFT JOIN public.project_contract_breakdowns pcb ON pcb.project_id = p.id;

-- Grant appropriate permissions on the view
GRANT SELECT ON project_financial_summary TO authenticated;

-- 9. Create function to ensure contract amount consistency
CREATE OR REPLACE FUNCTION sync_project_contract_amount() RETURNS TRIGGER AS $$
BEGIN
    -- Update the project's original_contract to match the contract breakdown total
    UPDATE public.projects 
    SET original_contract = NEW.total_contract_amount
    WHERE id = NEW.project_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync contract amounts
CREATE TRIGGER sync_contract_amount_on_breakdown
    AFTER INSERT OR UPDATE ON public.project_contract_breakdowns
    FOR EACH ROW
    EXECUTE FUNCTION sync_project_contract_amount();

-- 10. Add helper function to calculate project profitability
CREATE OR REPLACE FUNCTION calculate_project_profitability(p_project_id UUID)
RETURNS TABLE (
    estimated_gross_profit DECIMAL(15, 2),
    estimated_profit_margin DECIMAL(5, 2),
    budget_vs_contract_variance DECIMAL(15, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(pcb.total_contract_amount, 0) - COALESCE(pb.total_budget, 0) as estimated_gross_profit,
        CASE 
            WHEN COALESCE(pcb.total_contract_amount, 0) > 0 
            THEN ((COALESCE(pcb.total_contract_amount, 0) - COALESCE(pb.total_budget, 0)) / pcb.total_contract_amount * 100)::DECIMAL(5, 2)
            ELSE 0::DECIMAL(5, 2)
        END as estimated_profit_margin,
        COALESCE(pb.total_budget, 0) - COALESCE(pcb.total_contract_amount, 0) as budget_vs_contract_variance
    FROM public.projects p
    LEFT JOIN public.project_budgets pb ON pb.project_id = p.id
    LEFT JOIN public.project_contract_breakdowns pcb ON pcb.project_id = p.id
    WHERE p.id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION calculate_project_profitability TO authenticated;