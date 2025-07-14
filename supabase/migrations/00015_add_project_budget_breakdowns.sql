-- Migration: Add project_budget_breakdowns table for detailed budget import data
-- This table stores the detailed breakdown from Excel budget imports

-- Create project_budget_breakdowns table
CREATE TABLE IF NOT EXISTS public.project_budget_breakdowns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Discipline and cost type information
    discipline VARCHAR(100) NOT NULL,
    cost_type VARCHAR(100) NOT NULL,
    
    -- Values from Excel
    manhours DECIMAL(15, 2),
    value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Optional description field
    description TEXT,
    
    -- Source tracking
    import_source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'excel_import', 'api'
    import_batch_id UUID, -- Groups records imported together
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_value CHECK (value >= 0),
    CONSTRAINT positive_manhours CHECK (manhours IS NULL OR manhours >= 0),
    CONSTRAINT unique_budget_line UNIQUE (project_id, discipline, cost_type)
);

-- Create indexes
CREATE INDEX idx_budget_breakdowns_project ON public.project_budget_breakdowns(project_id);
CREATE INDEX idx_budget_breakdowns_discipline ON public.project_budget_breakdowns(discipline);
CREATE INDEX idx_budget_breakdowns_cost_type ON public.project_budget_breakdowns(cost_type);
CREATE INDEX idx_budget_breakdowns_batch ON public.project_budget_breakdowns(import_batch_id);

-- Add composite index for common queries
CREATE INDEX idx_budget_breakdowns_project_discipline ON public.project_budget_breakdowns(project_id, discipline);

-- Add comments for documentation
COMMENT ON TABLE public.project_budget_breakdowns IS 'Detailed budget breakdown by discipline and cost type from Excel imports';
COMMENT ON COLUMN public.project_budget_breakdowns.discipline IS 'Major discipline category (e.g., PIPING, STEEL, ELECTRICAL)';
COMMENT ON COLUMN public.project_budget_breakdowns.cost_type IS 'Type of cost (e.g., DIRECT LABOR, MATERIALS, EQUIPMENT)';
COMMENT ON COLUMN public.project_budget_breakdowns.manhours IS 'Estimated manhours for this line item';
COMMENT ON COLUMN public.project_budget_breakdowns.value IS 'Dollar value for this line item';
COMMENT ON COLUMN public.project_budget_breakdowns.description IS 'Optional description or notes for this line item';
COMMENT ON COLUMN public.project_budget_breakdowns.import_source IS 'Source of the data: manual entry, excel import, or API';
COMMENT ON COLUMN public.project_budget_breakdowns.import_batch_id IS 'Groups rows imported together in a single import operation';

-- Create update trigger for timestamp
CREATE TRIGGER update_budget_breakdowns_updated_at 
    BEFORE UPDATE ON public.project_budget_breakdowns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit log trigger
CREATE OR REPLACE FUNCTION log_budget_breakdown_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (entity_type, entity_id, action, changes, performed_by)
        VALUES ('budget_breakdown', NEW.id, 'create', to_jsonb(NEW), NEW.created_by);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_log (entity_type, entity_id, action, changes, performed_by)
        VALUES ('budget_breakdown', NEW.id, 'update', 
                jsonb_build_object(
                    'old', to_jsonb(OLD), 
                    'new', to_jsonb(NEW),
                    'changed_fields', (
                        SELECT jsonb_object_agg(key, value)
                        FROM jsonb_each(to_jsonb(NEW))
                        WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key
                    )
                ), 
                NEW.created_by);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_log (entity_type, entity_id, action, changes, performed_by)
        VALUES ('budget_breakdown', OLD.id, 'delete', to_jsonb(OLD), OLD.created_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_budget_breakdowns
    AFTER INSERT OR UPDATE OR DELETE ON public.project_budget_breakdowns
    FOR EACH ROW
    EXECUTE FUNCTION log_budget_breakdown_changes();

-- Add RLS policies
ALTER TABLE public.project_budget_breakdowns ENABLE ROW LEVEL SECURITY;

-- Policy: Controllers and executives can view all budget breakdowns
CREATE POLICY budget_breakdowns_view_all ON public.project_budget_breakdowns
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role IN ('controller', 'executive')
        )
    );

-- Policy: Ops managers can view budget breakdowns for projects in their division
CREATE POLICY budget_breakdowns_view_division ON public.project_budget_breakdowns
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.profiles u ON u.id = auth.uid()
            WHERE u.role = 'ops_manager' 
            AND p.division_id = u.division_id
        )
    );

-- Policy: Project managers can view breakdowns for their projects
CREATE POLICY budget_breakdowns_view_own ON public.project_budget_breakdowns
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE project_manager_id = auth.uid() 
               OR superintendent_id = auth.uid()
        )
    );

-- Policy: Accounting can view all budget breakdowns
CREATE POLICY budget_breakdowns_view_accounting ON public.project_budget_breakdowns
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role = 'accounting'
        )
    );

-- Policy: Controllers can manage budget breakdowns
CREATE POLICY budget_breakdowns_manage ON public.project_budget_breakdowns
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role = 'controller'
        )
    );

-- Grant permissions
GRANT SELECT ON public.project_budget_breakdowns TO authenticated;
GRANT ALL ON public.project_budget_breakdowns TO service_role;

-- Create helper views for analysis

-- View for budget breakdown summary by project
CREATE OR REPLACE VIEW project_budget_breakdown_summary AS
SELECT 
    pbb.project_id,
    p.job_number,
    p.name as project_name,
    pbb.discipline,
    SUM(CASE WHEN pbb.cost_type LIKE '%LABOR%' THEN pbb.value ELSE 0 END) as labor_total,
    SUM(CASE WHEN pbb.cost_type = 'MATERIALS' THEN pbb.value ELSE 0 END) as materials_total,
    SUM(CASE WHEN pbb.cost_type = 'EQUIPMENT' THEN pbb.value ELSE 0 END) as equipment_total,
    SUM(CASE WHEN pbb.cost_type = 'SUBCONTRACT' THEN pbb.value ELSE 0 END) as subcontract_total,
    SUM(CASE WHEN pbb.cost_type NOT IN ('DIRECT LABOR', 'INDIRECT LABOR', 'MATERIALS', 'EQUIPMENT', 'SUBCONTRACT') 
         AND pbb.cost_type NOT LIKE '%LABOR%' THEN pbb.value ELSE 0 END) as other_total,
    SUM(pbb.value) as discipline_total,
    SUM(COALESCE(pbb.manhours, 0)) as total_manhours
FROM public.project_budget_breakdowns pbb
JOIN public.projects p ON p.id = pbb.project_id
GROUP BY pbb.project_id, p.job_number, p.name, pbb.discipline
ORDER BY p.job_number, pbb.discipline;

-- Grant access to the view
GRANT SELECT ON project_budget_breakdown_summary TO authenticated;

-- Function to calculate total budget from breakdowns
CREATE OR REPLACE FUNCTION calculate_project_budget_from_breakdowns(p_project_id UUID)
RETURNS TABLE (
    total_budget DECIMAL(15, 2),
    total_labor DECIMAL(15, 2),
    total_materials DECIMAL(15, 2),
    total_equipment DECIMAL(15, 2),
    total_subcontract DECIMAL(15, 2),
    total_other DECIMAL(15, 2),
    total_manhours DECIMAL(10, 2),
    discipline_count INTEGER,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(value), 0)::DECIMAL(15, 2) as total_budget,
        COALESCE(SUM(CASE WHEN cost_type LIKE '%LABOR%' THEN value ELSE 0 END), 0)::DECIMAL(15, 2) as total_labor,
        COALESCE(SUM(CASE WHEN cost_type = 'MATERIALS' THEN value ELSE 0 END), 0)::DECIMAL(15, 2) as total_materials,
        COALESCE(SUM(CASE WHEN cost_type = 'EQUIPMENT' THEN value ELSE 0 END), 0)::DECIMAL(15, 2) as total_equipment,
        COALESCE(SUM(CASE WHEN cost_type = 'SUBCONTRACT' THEN value ELSE 0 END), 0)::DECIMAL(15, 2) as total_subcontract,
        COALESCE(SUM(CASE WHEN cost_type NOT IN ('DIRECT LABOR', 'INDIRECT LABOR', 'MATERIALS', 'EQUIPMENT', 'SUBCONTRACT') 
                 AND cost_type NOT LIKE '%LABOR%' THEN value ELSE 0 END), 0)::DECIMAL(15, 2) as total_other,
        COALESCE(SUM(manhours), 0)::DECIMAL(10, 2) as total_manhours,
        COUNT(DISTINCT discipline)::INTEGER as discipline_count,
        MAX(updated_at) as last_updated
    FROM public.project_budget_breakdowns
    WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_project_budget_from_breakdowns TO authenticated;

-- Function to get budget breakdown by discipline
CREATE OR REPLACE FUNCTION get_project_budget_by_discipline(p_project_id UUID)
RETURNS TABLE (
    discipline VARCHAR(100),
    total_value DECIMAL(15, 2),
    labor_value DECIMAL(15, 2),
    materials_value DECIMAL(15, 2),
    equipment_value DECIMAL(15, 2),
    subcontract_value DECIMAL(15, 2),
    other_value DECIMAL(15, 2),
    total_manhours DECIMAL(10, 2),
    percentage_of_total DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH discipline_totals AS (
        SELECT 
            discipline,
            SUM(value) as total_value,
            SUM(CASE WHEN cost_type LIKE '%LABOR%' THEN value ELSE 0 END) as labor_value,
            SUM(CASE WHEN cost_type = 'MATERIALS' THEN value ELSE 0 END) as materials_value,
            SUM(CASE WHEN cost_type = 'EQUIPMENT' THEN value ELSE 0 END) as equipment_value,
            SUM(CASE WHEN cost_type = 'SUBCONTRACT' THEN value ELSE 0 END) as subcontract_value,
            SUM(CASE WHEN cost_type NOT IN ('DIRECT LABOR', 'INDIRECT LABOR', 'MATERIALS', 'EQUIPMENT', 'SUBCONTRACT') 
                 AND cost_type NOT LIKE '%LABOR%' THEN value ELSE 0 END) as other_value,
            SUM(COALESCE(manhours, 0)) as total_manhours
        FROM public.project_budget_breakdowns
        WHERE project_id = p_project_id
        GROUP BY discipline
    ),
    project_total AS (
        SELECT SUM(total_value) as grand_total
        FROM discipline_totals
    )
    SELECT 
        dt.discipline,
        dt.total_value::DECIMAL(15, 2),
        dt.labor_value::DECIMAL(15, 2),
        dt.materials_value::DECIMAL(15, 2),
        dt.equipment_value::DECIMAL(15, 2),
        dt.subcontract_value::DECIMAL(15, 2),
        dt.other_value::DECIMAL(15, 2),
        dt.total_manhours::DECIMAL(10, 2),
        CASE 
            WHEN pt.grand_total > 0 
            THEN (dt.total_value / pt.grand_total * 100)::DECIMAL(5, 2)
            ELSE 0::DECIMAL(5, 2)
        END as percentage_of_total
    FROM discipline_totals dt
    CROSS JOIN project_total pt
    ORDER BY dt.total_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_project_budget_by_discipline TO authenticated;