-- Add cost_type column to budget_line_items for detailed cost categorization
-- This enables queries by specific cost categories like Perdiem, Materials, etc.

-- Add cost_type column
ALTER TABLE public.budget_line_items
ADD COLUMN cost_type varchar;

-- Add comment
COMMENT ON COLUMN public.budget_line_items.cost_type IS 'Specific cost type (e.g., Direct Labor, Indirect Labor, Perdiem, Materials, Equipment, etc.)';

-- Create index for performance
CREATE INDEX idx_budget_line_items_cost_type ON public.budget_line_items(cost_type);

-- Create view for budget rollups by cost type
CREATE VIEW public.budget_cost_type_rollup AS
SELECT 
  project_id,
  cost_type,
  discipline,
  COUNT(*) as line_item_count,
  SUM(total_cost) as total_cost,
  SUM(manhours) as total_manhours,
  SUM(labor_cost) as labor_cost,
  SUM(material_cost) as material_cost,
  SUM(equipment_cost) as equipment_cost,
  SUM(subcontract_cost) as subcontract_cost,
  SUM(other_cost) as other_cost,
  STRING_AGG(DISTINCT source_sheet, ', ' ORDER BY source_sheet) as source_sheets
FROM public.budget_line_items
WHERE cost_type IS NOT NULL
GROUP BY project_id, cost_type, discipline;

-- Create view for project-level cost type summary (across all disciplines)
CREATE VIEW public.project_cost_type_summary AS
SELECT 
  project_id,
  cost_type,
  COUNT(DISTINCT discipline) as discipline_count,
  COUNT(*) as line_item_count,
  SUM(total_cost) as total_cost,
  SUM(manhours) as total_manhours,
  ROUND(AVG(CASE WHEN manhours > 0 THEN total_cost / manhours ELSE NULL END), 2) as avg_cost_per_hour
FROM public.budget_line_items
WHERE cost_type IS NOT NULL
GROUP BY project_id, cost_type
ORDER BY project_id, total_cost DESC;

-- Note: Views inherit RLS policies from their underlying tables
-- budget_cost_type_rollup and project_cost_type_summary will respect
-- the RLS policies already defined on budget_line_items

-- Add comments for views
COMMENT ON VIEW public.budget_cost_type_rollup IS 'Budget data aggregated by cost type and discipline for detailed analysis';
COMMENT ON VIEW public.project_cost_type_summary IS 'Project-level summary of costs by type across all disciplines';