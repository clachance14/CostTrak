-- Migration: Add project_po_line_items table for dynamic PO line items
-- This replaces the fixed labor/materials/demo columns with flexible line items

-- 1. Create project_po_line_items table
CREATE TABLE IF NOT EXISTS public.project_po_line_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Line item details
    line_number INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique line numbers per project
    UNIQUE(project_id, line_number)
);

-- Create indexes
CREATE INDEX idx_po_line_items_project ON public.project_po_line_items(project_id);
CREATE INDEX idx_po_line_items_amount ON public.project_po_line_items(amount);

-- Add comments for documentation
COMMENT ON TABLE public.project_po_line_items IS 'Dynamic PO line items for project contracts';
COMMENT ON COLUMN public.project_po_line_items.line_number IS 'Sequential line number within the project';
COMMENT ON COLUMN public.project_po_line_items.description IS 'Description of the line item (e.g., Labor, Materials, Engineering, etc.)';
COMMENT ON COLUMN public.project_po_line_items.amount IS 'Dollar amount for this line item';

-- 2. Add new columns to project_contract_breakdowns for transition
ALTER TABLE public.project_contract_breakdowns
ADD COLUMN IF NOT EXISTS uses_line_items BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.project_contract_breakdowns.uses_line_items IS 'Flag to indicate if this project uses the new line items structure';

-- 3. Create update trigger for timestamp
CREATE TRIGGER update_po_line_items_updated_at 
    BEFORE UPDATE ON public.project_po_line_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Add RLS policies
ALTER TABLE public.project_po_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: Controllers and executives can view all PO line items
CREATE POLICY po_line_items_view_all ON public.project_po_line_items
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role IN ('controller', 'executive', 'accounting')
        )
    );

-- Policy: Project managers can view line items for their projects
CREATE POLICY po_line_items_view_own ON public.project_po_line_items
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE project_manager_id = auth.uid() 
               OR superintendent_id = auth.uid()
        )
    );

-- Policy: All authenticated users can manage PO line items
CREATE POLICY po_line_items_manage ON public.project_po_line_items
    FOR ALL
    USING (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT ON public.project_po_line_items TO authenticated;
GRANT ALL ON public.project_po_line_items TO service_role;

-- 5. Create function to calculate total contract from line items
CREATE OR REPLACE FUNCTION calculate_project_contract_from_line_items(p_project_id UUID)
RETURNS DECIMAL(15, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount) 
         FROM public.project_po_line_items 
         WHERE project_id = p_project_id),
        0
    )::DECIMAL(15, 2);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_project_contract_from_line_items TO authenticated;

-- 6. Create view for project contract summary
CREATE OR REPLACE VIEW project_contract_summary AS
SELECT 
    p.id,
    p.job_number,
    p.name,
    pcb.client_po_number,
    pcb.client_representative,
    CASE 
        WHEN pcb.uses_line_items THEN 
            calculate_project_contract_from_line_items(p.id)
        ELSE 
            pcb.total_contract_amount
    END as total_contract_amount,
    pcb.uses_line_items,
    (SELECT COUNT(*) FROM public.project_po_line_items WHERE project_id = p.id) as line_item_count
FROM public.projects p
LEFT JOIN public.project_contract_breakdowns pcb ON pcb.project_id = p.id;

-- Grant access to the view
GRANT SELECT ON project_contract_summary TO authenticated;