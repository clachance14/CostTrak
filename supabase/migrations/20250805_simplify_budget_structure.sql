-- Simplify budget structure to align with PO categories
-- This migration adds budget summary fields to projects table and 
-- modifies budget_line_items to use simplified cost structure

-- 1. Add budget summary fields to projects table
ALTER TABLE public.projects 
ADD COLUMN labor_direct_budget numeric DEFAULT 0,
ADD COLUMN labor_indirect_budget numeric DEFAULT 0,
ADD COLUMN labor_staff_budget numeric DEFAULT 0,
ADD COLUMN materials_budget numeric DEFAULT 0,
ADD COLUMN equipment_budget numeric DEFAULT 0,
ADD COLUMN subcontracts_budget numeric DEFAULT 0,
ADD COLUMN small_tools_budget numeric DEFAULT 0,
ADD COLUMN total_labor_budget numeric DEFAULT 0,
ADD COLUMN total_non_labor_budget numeric DEFAULT 0,
ADD COLUMN total_budget numeric DEFAULT 0,
ADD COLUMN budget_imported_at timestamptz,
ADD COLUMN budget_imported_by uuid;

-- Add foreign key constraint for budget_imported_by
ALTER TABLE public.projects 
ADD CONSTRAINT projects_budget_imported_by_fkey 
FOREIGN KEY (budget_imported_by) REFERENCES public.profiles(id);

-- 2. Modify budget_line_items table structure
-- First, remove existing cost breakdown columns
ALTER TABLE public.budget_line_items 
DROP COLUMN IF EXISTS labor_cost,
DROP COLUMN IF EXISTS material_cost,
DROP COLUMN IF EXISTS equipment_cost,
DROP COLUMN IF EXISTS subcontract_cost,
DROP COLUMN IF EXISTS other_cost;

-- Add new simplified cost structure aligned with PO categories
ALTER TABLE public.budget_line_items 
ADD COLUMN labor_direct_cost numeric DEFAULT 0,
ADD COLUMN labor_indirect_cost numeric DEFAULT 0,
ADD COLUMN labor_staff_cost numeric DEFAULT 0,
ADD COLUMN materials_cost numeric DEFAULT 0,
ADD COLUMN equipment_cost numeric DEFAULT 0,
ADD COLUMN subcontracts_cost numeric DEFAULT 0,
ADD COLUMN small_tools_cost numeric DEFAULT 0;

-- Update category constraint to simplified structure
ALTER TABLE public.budget_line_items 
DROP CONSTRAINT IF EXISTS budget_line_items_category_check;

ALTER TABLE public.budget_line_items 
ADD CONSTRAINT budget_line_items_category_check 
CHECK (category IN ('LABOR', 'NON_LABOR'));

-- 3. Update existing budget views to use new structure
DROP VIEW IF EXISTS public.budget_wbs_rollup;
DROP VIEW IF EXISTS public.budget_category_rollup;

-- Create updated budget rollup view by WBS
CREATE VIEW public.budget_wbs_rollup AS
SELECT 
  bli.project_id,
  bli.wbs_code,
  ws.description as wbs_description,
  ws.level as wbs_level,
  ws.parent_code,
  COUNT(*) as line_item_count,
  SUM(bli.total_cost) as total_budget,
  SUM(bli.labor_direct_cost + bli.labor_indirect_cost + bli.labor_staff_cost) as labor_budget,
  SUM(bli.materials_cost + bli.equipment_cost + bli.subcontracts_cost + bli.small_tools_cost) as non_labor_budget,
  SUM(bli.labor_direct_cost) as labor_direct_budget,
  SUM(bli.labor_indirect_cost) as labor_indirect_budget,
  SUM(bli.labor_staff_cost) as labor_staff_budget,
  SUM(bli.materials_cost) as materials_budget,
  SUM(bli.equipment_cost) as equipment_budget,
  SUM(bli.subcontracts_cost) as subcontracts_budget,
  SUM(bli.small_tools_cost) as small_tools_budget,
  SUM(bli.manhours) as total_manhours,
  STRING_AGG(DISTINCT bli.source_sheet, ', ') as source_sheets
FROM public.budget_line_items bli
LEFT JOIN public.wbs_structure ws ON bli.project_id = ws.project_id AND bli.wbs_code = ws.code
GROUP BY bli.project_id, bli.wbs_code, ws.description, ws.level, ws.parent_code;

-- Create updated budget rollup view by category
CREATE VIEW public.budget_category_rollup AS
SELECT 
  project_id,
  category,
  subcategory,
  COUNT(*) as line_item_count,
  SUM(total_cost) as total_budget,
  SUM(labor_direct_cost) as labor_direct_budget,
  SUM(labor_indirect_cost) as labor_indirect_budget,
  SUM(labor_staff_cost) as labor_staff_budget,
  SUM(materials_cost) as materials_budget,
  SUM(equipment_cost) as equipment_budget,
  SUM(subcontracts_cost) as subcontracts_budget,
  SUM(small_tools_cost) as small_tools_budget,
  SUM(manhours) as total_manhours,
  STRING_AGG(DISTINCT source_sheet, ', ') as source_sheets
FROM public.budget_line_items
GROUP BY project_id, category, subcategory;

-- 4. Add comments for documentation
COMMENT ON COLUMN public.projects.labor_direct_budget IS 'Direct labor budget total from budget import';
COMMENT ON COLUMN public.projects.labor_indirect_budget IS 'Indirect labor budget total (includes add-ons and proportional perdiem)';
COMMENT ON COLUMN public.projects.labor_staff_budget IS 'Staff labor budget total';
COMMENT ON COLUMN public.projects.materials_budget IS 'Materials budget total (aligns with PO category)';
COMMENT ON COLUMN public.projects.equipment_budget IS 'Equipment budget total (aligns with PO category)';
COMMENT ON COLUMN public.projects.subcontracts_budget IS 'Subcontracts budget total (includes scaffolding, aligns with PO category)';
COMMENT ON COLUMN public.projects.small_tools_budget IS 'Small tools & consumables budget total (aligns with PO category)';
COMMENT ON COLUMN public.projects.total_labor_budget IS 'Total of all labor categories';
COMMENT ON COLUMN public.projects.total_non_labor_budget IS 'Total of all non-labor categories';
COMMENT ON COLUMN public.projects.total_budget IS 'Grand total budget from import';

COMMENT ON VIEW public.budget_wbs_rollup IS 'Budget data rolled up by WBS code with simplified cost structure';
COMMENT ON VIEW public.budget_category_rollup IS 'Budget data rolled up by category with simplified cost structure';