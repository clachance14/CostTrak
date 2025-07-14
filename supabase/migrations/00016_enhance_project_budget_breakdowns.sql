-- Migration: Enhance project_budget_breakdowns table to match expected schema
-- This migration adds missing columns, constraints, indexes, and features

-- Add missing columns to existing table
ALTER TABLE public.project_budget_breakdowns 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS import_source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS import_batch_id UUID,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add foreign key constraint for created_by if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_budget_breakdowns_created_by_fkey'
    ) THEN
        ALTER TABLE public.project_budget_breakdowns 
        ADD CONSTRAINT project_budget_breakdowns_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id);
    END IF;
END $$;

-- Add constraints if they don't exist
DO $$ 
BEGIN
    -- Add positive_value constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'positive_value_check'
    ) THEN
        ALTER TABLE public.project_budget_breakdowns 
        ADD CONSTRAINT positive_value_check CHECK (value >= 0);
    END IF;
    
    -- Add positive_manhours constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'positive_manhours_check'
    ) THEN
        ALTER TABLE public.project_budget_breakdowns 
        ADD CONSTRAINT positive_manhours_check CHECK (manhours IS NULL OR manhours >= 0);
    END IF;
    
    -- Add unique constraint for budget lines
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_budget_line'
    ) THEN
        ALTER TABLE public.project_budget_breakdowns 
        ADD CONSTRAINT unique_budget_line UNIQUE (project_id, discipline, cost_type);
    END IF;
END $$;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_budget_breakdowns_project ON public.project_budget_breakdowns(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_breakdowns_discipline ON public.project_budget_breakdowns(discipline);
CREATE INDEX IF NOT EXISTS idx_budget_breakdowns_cost_type ON public.project_budget_breakdowns(cost_type);
CREATE INDEX IF NOT EXISTS idx_budget_breakdowns_batch ON public.project_budget_breakdowns(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_breakdowns_project_discipline ON public.project_budget_breakdowns(project_id, discipline);

-- Add table and column comments
COMMENT ON TABLE public.project_budget_breakdowns IS 'Detailed budget breakdown by discipline and cost type from Excel imports';
COMMENT ON COLUMN public.project_budget_breakdowns.discipline IS 'Major discipline category (e.g., PIPING, STEEL, ELECTRICAL)';
COMMENT ON COLUMN public.project_budget_breakdowns.cost_type IS 'Type of cost (e.g., DIRECT LABOR, MATERIALS, EQUIPMENT)';
COMMENT ON COLUMN public.project_budget_breakdowns.manhours IS 'Estimated manhours for this line item';
COMMENT ON COLUMN public.project_budget_breakdowns.value IS 'Dollar value for this line item';
COMMENT ON COLUMN public.project_budget_breakdowns.description IS 'Optional description or notes for this line item';
COMMENT ON COLUMN public.project_budget_breakdowns.import_source IS 'Source of the data: manual entry, excel import, or API';
COMMENT ON COLUMN public.project_budget_breakdowns.import_batch_id IS 'Groups rows imported together in a single import operation';

-- Create update trigger for timestamp if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_budget_breakdowns_updated_at'
    ) THEN
        CREATE TRIGGER update_budget_breakdowns_updated_at 
            BEFORE UPDATE ON public.project_budget_breakdowns 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create audit log function for budget breakdowns
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
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'audit_budget_breakdowns'
    ) THEN
        CREATE TRIGGER audit_budget_breakdowns
            AFTER INSERT OR UPDATE OR DELETE ON public.project_budget_breakdowns
            FOR EACH ROW
            EXECUTE FUNCTION log_budget_breakdown_changes();
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE public.project_budget_breakdowns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist

-- Controllers and executives can view all budget breakdowns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'project_budget_breakdowns' 
        AND policyname = 'budget_breakdowns_view_all'
    ) THEN
        CREATE POLICY budget_breakdowns_view_all ON public.project_budget_breakdowns
            FOR SELECT
            USING (
                auth.uid() IN (
                    SELECT id FROM public.profiles 
                    WHERE role IN ('controller', 'executive')
                )
            );
    END IF;
END $$;

-- Ops managers can view budget breakdowns for projects in their division
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'project_budget_breakdowns' 
        AND policyname = 'budget_breakdowns_view_division'
    ) THEN
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
    END IF;
END $$;

-- Project managers can view breakdowns for their projects
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'project_budget_breakdowns' 
        AND policyname = 'budget_breakdowns_view_own'
    ) THEN
        CREATE POLICY budget_breakdowns_view_own ON public.project_budget_breakdowns
            FOR SELECT
            USING (
                project_id IN (
                    SELECT id FROM public.projects 
                    WHERE project_manager_id = auth.uid() 
                       OR superintendent_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Accounting can view all budget breakdowns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'project_budget_breakdowns' 
        AND policyname = 'budget_breakdowns_view_accounting'
    ) THEN
        CREATE POLICY budget_breakdowns_view_accounting ON public.project_budget_breakdowns
            FOR SELECT
            USING (
                auth.uid() IN (
                    SELECT id FROM public.profiles 
                    WHERE role = 'accounting'
                )
            );
    END IF;
END $$;

-- Controllers can manage budget breakdowns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'project_budget_breakdowns' 
        AND policyname = 'budget_breakdowns_manage'
    ) THEN
        CREATE POLICY budget_breakdowns_manage ON public.project_budget_breakdowns
            FOR ALL
            USING (
                auth.uid() IN (
                    SELECT id FROM public.profiles 
                    WHERE role = 'controller'
                )
            );
    END IF;
END $$;

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
            pbb.discipline,
            SUM(pbb.value) as total_value,
            SUM(CASE WHEN pbb.cost_type LIKE '%LABOR%' THEN pbb.value ELSE 0 END) as labor_value,
            SUM(CASE WHEN pbb.cost_type = 'MATERIALS' THEN pbb.value ELSE 0 END) as materials_value,
            SUM(CASE WHEN pbb.cost_type = 'EQUIPMENT' THEN pbb.value ELSE 0 END) as equipment_value,
            SUM(CASE WHEN pbb.cost_type = 'SUBCONTRACT' THEN pbb.value ELSE 0 END) as subcontract_value,
            SUM(CASE WHEN pbb.cost_type NOT IN ('DIRECT LABOR', 'INDIRECT LABOR', 'MATERIALS', 'EQUIPMENT', 'SUBCONTRACT') 
                 AND pbb.cost_type NOT LIKE '%LABOR%' THEN pbb.value ELSE 0 END) as other_value,
            SUM(COALESCE(pbb.manhours, 0)) as total_manhours
        FROM public.project_budget_breakdowns pbb
        WHERE pbb.project_id = p_project_id
        GROUP BY pbb.discipline
    ),
    project_total AS (
        SELECT SUM(total_value) as grand_total
        FROM discipline_totals
    )
    SELECT 
        dt.discipline::VARCHAR(100),
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