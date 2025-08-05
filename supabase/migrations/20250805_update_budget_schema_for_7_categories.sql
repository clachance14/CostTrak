-- Migration: Update budget schema for 7 simplified categories
-- Direct, Indirect, Staff Labor + Materials, Equipment, Subcontracts, Small Tools & Consumables

-- 1. Update budget_line_items table structure
-- First, add new columns
ALTER TABLE public.budget_line_items 
ADD COLUMN IF NOT EXISTS labor_direct_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_indirect_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_staff_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS materials_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS equipment_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subcontracts_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS small_tools_cost numeric DEFAULT 0;

-- Migrate existing data to new columns (if any exists)
UPDATE public.budget_line_items SET
  labor_direct_cost = CASE 
    WHEN category = 'LABOR' AND subcategory = 'DIRECT' THEN COALESCE(labor_cost, 0)
    ELSE 0 
  END,
  labor_indirect_cost = CASE 
    WHEN category = 'LABOR' AND subcategory = 'INDIRECT' THEN COALESCE(labor_cost, 0)
    ELSE 0 
  END,
  labor_staff_cost = CASE 
    WHEN category = 'LABOR' AND subcategory = 'STAFF' THEN COALESCE(labor_cost, 0)
    ELSE 0 
  END,
  materials_cost = COALESCE(material_cost, 0),
  equipment_cost = COALESCE(equipment_cost, 0),
  subcontracts_cost = COALESCE(subcontract_cost, 0),
  small_tools_cost = COALESCE(other_cost, 0);

-- Drop old columns
ALTER TABLE public.budget_line_items 
DROP COLUMN IF EXISTS labor_cost,
DROP COLUMN IF EXISTS material_cost,
DROP COLUMN IF EXISTS equipment_cost,
DROP COLUMN IF EXISTS subcontract_cost,
DROP COLUMN IF EXISTS other_cost;

-- Update category constraint to simplified structure
ALTER TABLE public.budget_line_items 
DROP CONSTRAINT IF EXISTS budget_line_items_category_check;

ALTER TABLE public.budget_line_items 
ADD CONSTRAINT budget_line_items_category_check 
CHECK (category IN ('LABOR', 'NON_LABOR'));

-- Add subcategory constraint
ALTER TABLE public.budget_line_items 
DROP CONSTRAINT IF EXISTS budget_line_items_subcategory_check;

ALTER TABLE public.budget_line_items 
ADD CONSTRAINT budget_line_items_subcategory_check 
CHECK (subcategory IN ('DIRECT', 'INDIRECT', 'STAFF', 'MATERIALS', 'EQUIPMENT', 'SUBCONTRACTS', 'SMALL_TOOLS'));

-- 2. Add budget fields to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS labor_direct_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_indirect_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_staff_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS materials_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS equipment_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subcontracts_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS small_tools_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_labor_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_non_labor_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_imported_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS budget_imported_by uuid;

-- Add foreign key for budget_imported_by
ALTER TABLE public.projects
ADD CONSTRAINT projects_budget_imported_by_fkey 
FOREIGN KEY (budget_imported_by) REFERENCES public.profiles(id);

-- 3. Create WBS structure table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wbs_structure (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL,
  category character varying NOT NULL CHECK (category IN ('LABOR', 'NON_LABOR')),
  description character varying NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wbs_structure_pkey PRIMARY KEY (id),
  CONSTRAINT wbs_structure_code_unique UNIQUE (code)
);

-- Insert standard WBS codes
INSERT INTO public.wbs_structure (code, category, description, sort_order)
VALUES 
  ('L-001', 'LABOR', 'Direct Labor', 1),
  ('L-002', 'LABOR', 'Indirect Labor', 2),
  ('L-003', 'LABOR', 'Staff Labor', 3),
  ('N-001', 'NON_LABOR', 'Materials', 4),
  ('N-002', 'NON_LABOR', 'Equipment', 5),
  ('N-003', 'NON_LABOR', 'Subcontracts', 6),
  ('N-004', 'NON_LABOR', 'Small Tools & Consumables', 7)
ON CONFLICT (code) DO NOTHING;

-- 4. Update any existing views that reference old columns
-- Drop and recreate budget views if they exist
DROP VIEW IF EXISTS public.budget_category_rollup;
DROP VIEW IF EXISTS public.budget_wbs_rollup;

-- Create updated budget rollup view by category
CREATE VIEW public.budget_category_rollup AS
SELECT 
  project_id,
  category,
  COUNT(*) as line_item_count,
  SUM(total_cost) as total_budget,
  SUM(labor_direct_cost + labor_indirect_cost + labor_staff_cost) as labor_budget,
  SUM(materials_cost + equipment_cost + subcontracts_cost + small_tools_cost) as non_labor_budget,
  SUM(labor_direct_cost) as direct_labor_budget,
  SUM(labor_indirect_cost) as indirect_labor_budget,
  SUM(labor_staff_cost) as staff_labor_budget,
  SUM(materials_cost) as materials_budget,
  SUM(equipment_cost) as equipment_budget,
  SUM(subcontracts_cost) as subcontracts_budget,
  SUM(small_tools_cost) as small_tools_budget
FROM public.budget_line_items
GROUP BY project_id, category;

-- Create updated budget rollup view by WBS
CREATE VIEW public.budget_wbs_rollup AS
SELECT 
  bli.project_id,
  bli.wbs_code,
  ws.description as wbs_description,
  ws.category as wbs_category,
  COUNT(*) as line_item_count,
  SUM(bli.total_cost) as total_budget,
  SUM(bli.labor_direct_cost + bli.labor_indirect_cost + bli.labor_staff_cost) as labor_budget,
  SUM(bli.materials_cost + bli.equipment_cost + bli.subcontracts_cost + bli.small_tools_cost) as non_labor_budget
FROM public.budget_line_items bli
LEFT JOIN public.wbs_structure ws ON bli.wbs_code = ws.code
GROUP BY bli.project_id, bli.wbs_code, ws.description, ws.category;

-- 5. Update RLS policies if needed
-- Enable RLS on new table
ALTER TABLE public.wbs_structure ENABLE ROW LEVEL SECURITY;

-- Create policy for wbs_structure (all authenticated users can read)
CREATE POLICY "Authenticated users can view WBS structure" ON public.wbs_structure
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comment explaining the migration
COMMENT ON TABLE public.budget_line_items IS 'Budget line items with 7 simplified categories: Direct/Indirect/Staff Labor + Materials/Equipment/Subcontracts/Small Tools';
COMMENT ON TABLE public.wbs_structure IS 'Simple WBS structure for budget categorization';