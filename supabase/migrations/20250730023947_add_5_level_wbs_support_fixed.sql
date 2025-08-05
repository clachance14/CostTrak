-- Migration: Add 5-Level WBS Support for CostTrak (Fixed Version)
-- Description: Extends WBS from 3 to 5 levels, adds labor categories, phase allocations
-- Author: Supabase Architect
-- Date: 2025-01-30

BEGIN;

-- =====================================================
-- 1. EXTEND WBS STRUCTURE TABLE
-- =====================================================
-- Update constraint to allow 5 levels
ALTER TABLE public.wbs_structure 
DROP CONSTRAINT IF EXISTS check_level,
ADD CONSTRAINT check_level CHECK (level BETWEEN 1 AND 5);

-- Add new columns for enhanced tracking
ALTER TABLE public.wbs_structure
ADD COLUMN IF NOT EXISTS phase VARCHAR,
ADD COLUMN IF NOT EXISTS cost_type VARCHAR CHECK (cost_type IN ('DL', 'IL', 'MAT', 'EQ', 'SUB')),
ADD COLUMN IF NOT EXISTS labor_category_id UUID,
ADD COLUMN IF NOT EXISTS legacy_code VARCHAR,
ADD COLUMN IF NOT EXISTS path TEXT[],
ADD COLUMN IF NOT EXISTS sort_order INTEGER,
ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wbs_structure_phase ON public.wbs_structure(phase);
CREATE INDEX IF NOT EXISTS idx_wbs_structure_cost_type ON public.wbs_structure(cost_type);
CREATE INDEX IF NOT EXISTS idx_wbs_structure_path ON public.wbs_structure USING GIN(path);
CREATE INDEX IF NOT EXISTS idx_wbs_structure_sort_order ON public.wbs_structure(sort_order);

-- =====================================================
-- 2. CREATE LABOR CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.labor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type VARCHAR NOT NULL CHECK (category_type IN ('DIRECT', 'INDIRECT')),
  name VARCHAR NOT NULL,
  code VARCHAR(10) UNIQUE,
  standard_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_labor_categories_type ON labor_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_labor_categories_active ON labor_categories(is_active) WHERE is_active = true;

-- =====================================================
-- 3. CREATE PHASE ALLOCATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.phase_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wbs_code VARCHAR NOT NULL,
  phase VARCHAR NOT NULL CHECK (phase IN ('JOB_SET_UP', 'PRE_WORK', 'PROJECT_EXECUTION', 'JOB_CLOSE_OUT')),
  role VARCHAR NOT NULL,
  fte DECIMAL(5,2) NOT NULL CHECK (fte > 0),
  duration_months INTEGER NOT NULL CHECK (duration_months > 0),
  monthly_rate DECIMAL(10,2) NOT NULL,
  perdiem DECIMAL(10,2),
  add_ons DECIMAL(10,2),
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (
    fte * duration_months * (monthly_rate + COALESCE(perdiem, 0) + COALESCE(add_ons, 0))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phase_allocations_project_phase ON phase_allocations(project_id, phase);
CREATE INDEX IF NOT EXISTS idx_phase_allocations_wbs ON phase_allocations(wbs_code);

-- =====================================================
-- 4. CREATE DISCIPLINE REGISTRY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.discipline_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  parent_group VARCHAR NOT NULL CHECK (parent_group IN ('MECHANICAL', 'CIVIL', 'I&E', 'GENERAL')),
  wbs_code_prefix VARCHAR(10),
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_discipline_registry_parent ON discipline_registry(parent_group);

-- =====================================================
-- 5. CREATE DIRECT LABOR ALLOCATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.direct_labor_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wbs_code VARCHAR NOT NULL,
  discipline VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  labor_category_id UUID REFERENCES labor_categories(id),
  manhours DECIMAL(10,2) NOT NULL CHECK (manhours >= 0),
  crew_size INTEGER,
  duration_days DECIMAL(10,2),
  rate DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (manhours * rate) STORED,
  source_sheet VARCHAR,
  source_row INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_direct_labor_project ON direct_labor_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_direct_labor_discipline ON direct_labor_allocations(discipline);
CREATE INDEX IF NOT EXISTS idx_direct_labor_wbs ON direct_labor_allocations(wbs_code);

-- =====================================================
-- 6. UPDATE BUDGET LINE ITEMS TABLE
-- =====================================================
-- Add new columns for 5-level support
ALTER TABLE public.budget_line_items
ADD COLUMN IF NOT EXISTS wbs_level4 VARCHAR,
ADD COLUMN IF NOT EXISTS wbs_level5 VARCHAR,
ADD COLUMN IF NOT EXISTS phase VARCHAR,
ADD COLUMN IF NOT EXISTS labor_category VARCHAR,
ADD COLUMN IF NOT EXISTS is_add_on BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS discipline_group VARCHAR;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_budget_line_items_phase ON budget_line_items(phase);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_labor_category ON budget_line_items(labor_category);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_wbs_levels ON budget_line_items(wbs_level4, wbs_level5);

-- =====================================================
-- 7. CREATE SIMPLE VIEW FOR WBS ROLLUPS
-- =====================================================
-- Create a simple view instead of materialized view for now
CREATE OR REPLACE VIEW v_wbs_rollups AS
WITH budget_rollups AS (
  SELECT 
    project_id,
    wbs_code,
    SUM(total_cost) as total_budget,
    SUM(labor_cost) as labor_budget,
    SUM(material_cost) as material_budget,
    SUM(equipment_cost) as equipment_budget,
    SUM(subcontract_cost) as subcontract_budget,
    COUNT(*) as line_count
  FROM budget_line_items
  GROUP BY project_id, wbs_code
)
SELECT 
  w.*,
  COALESCE(b.total_budget, 0) as calculated_budget,
  COALESCE(b.labor_budget, 0) as labor_budget,
  COALESCE(b.material_budget, 0) as material_budget,
  COALESCE(b.equipment_budget, 0) as equipment_budget,
  COALESCE(b.subcontract_budget, 0) as subcontract_budget,
  COALESCE(b.line_count, 0) as line_item_count
FROM wbs_structure w
LEFT JOIN budget_rollups b ON w.project_id = b.project_id AND w.code = b.wbs_code;

-- =====================================================
-- 8. SIMPLE RLS POLICIES (AUTH USERS ONLY)
-- =====================================================
-- Enable RLS on new tables
ALTER TABLE public.labor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_labor_allocations ENABLE ROW LEVEL SECURITY;

-- Simple policy: All authenticated users can read
CREATE POLICY "Authenticated users can view labor categories" ON public.labor_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view phase allocations" ON public.phase_allocations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view discipline registry" ON public.discipline_registry
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view direct labor allocations" ON public.direct_labor_allocations
  FOR SELECT TO authenticated USING (true);

-- Simple policy: All authenticated users can manage (temporary for development)
CREATE POLICY "Authenticated users can manage labor categories" ON public.labor_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage phase allocations" ON public.phase_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage discipline registry" ON public.discipline_registry
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage direct labor allocations" ON public.direct_labor_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 9. CREATE UPDATE TRIGGERS
-- =====================================================
-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for all new tables
CREATE TRIGGER update_labor_categories_updated_at
  BEFORE UPDATE ON public.labor_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase_allocations_updated_at
  BEFORE UPDATE ON public.phase_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discipline_registry_updated_at
  BEFORE UPDATE ON public.discipline_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_direct_labor_allocations_updated_at
  BEFORE UPDATE ON public.direct_labor_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. SEED REFERENCE DATA
-- =====================================================
-- Insert all 39 direct labor categories
INSERT INTO public.labor_categories (category_type, name, code, standard_rate, sort_order) VALUES
('DIRECT', 'Boiler Maker - Class A', 'DL001', 85, 1),
('DIRECT', 'Boiler Maker - Class B', 'DL002', 75, 2),
('DIRECT', 'Carpenter - Class A', 'DL003', 70, 3),
('DIRECT', 'Carpenter - Class B', 'DL004', 60, 4),
('DIRECT', 'Crane Operator A', 'DL005', 90, 5),
('DIRECT', 'Crane Operator B', 'DL006', 80, 6),
('DIRECT', 'Electrician - Class A', 'DL007', 85, 7),
('DIRECT', 'Electrician - Class B', 'DL008', 75, 8),
('DIRECT', 'Electrician - Class C', 'DL009', 65, 9),
('DIRECT', 'Equipment Operator - Class A', 'DL010', 75, 10),
('DIRECT', 'Equipment Operator - Class B', 'DL011', 65, 11),
('DIRECT', 'Equipment Operator - Class C', 'DL012', 55, 12),
('DIRECT', 'Field Engineer A', 'DL013', 95, 13),
('DIRECT', 'Field Engineer B', 'DL014', 85, 14),
('DIRECT', 'Fitter - Class A', 'DL015', 80, 15),
('DIRECT', 'Fitter - Class B', 'DL016', 70, 16),
('DIRECT', 'General Foreman', 'DL017', 100, 17),
('DIRECT', 'Helper', 'DL018', 45, 18),
('DIRECT', 'Instrument Tech - Class A', 'DL019', 85, 19),
('DIRECT', 'Instrument Tech - Class B', 'DL020', 75, 20),
('DIRECT', 'Instrument Tech - Class C', 'DL021', 65, 21),
('DIRECT', 'Ironworker - Class A', 'DL022', 80, 22),
('DIRECT', 'Ironworker - Class B', 'DL023', 70, 23),
('DIRECT', 'Laborer - Class A', 'DL024', 50, 24),
('DIRECT', 'Laborer - Class B', 'DL025', 40, 25),
('DIRECT', 'Millwright A', 'DL026', 85, 26),
('DIRECT', 'Millwright B', 'DL027', 75, 27),
('DIRECT', 'Operating Engineer A', 'DL028', 85, 28),
('DIRECT', 'Operating Engineer B', 'DL029', 75, 29),
('DIRECT', 'Operator A', 'DL030', 70, 30),
('DIRECT', 'Operator B', 'DL031', 60, 31),
('DIRECT', 'Painter', 'DL032', 65, 32),
('DIRECT', 'Piping Foreman', 'DL033', 95, 33),
('DIRECT', 'Supervisor', 'DL034', 110, 34),
('DIRECT', 'Surveyor A', 'DL035', 80, 35),
('DIRECT', 'Surveyor B', 'DL036', 70, 36),
('DIRECT', 'Warehouse', 'DL037', 55, 37),
('DIRECT', 'Welder - Class A', 'DL038', 90, 38),
('DIRECT', 'Welder - Class B', 'DL039', 80, 39)
ON CONFLICT (code) DO NOTHING;

-- Insert all 23 indirect labor roles
INSERT INTO public.labor_categories (category_type, name, code, sort_order) VALUES
('INDIRECT', 'Area Superintendent', 'IL001', 1),
('INDIRECT', 'Clerk', 'IL002', 2),
('INDIRECT', 'Cost Engineer', 'IL003', 3),
('INDIRECT', 'Field Engineer', 'IL004', 4),
('INDIRECT', 'Field Exchanger General Foreman', 'IL005', 5),
('INDIRECT', 'General Foreman', 'IL006', 6),
('INDIRECT', 'Lead Planner', 'IL007', 7),
('INDIRECT', 'Lead Scheduler', 'IL008', 8),
('INDIRECT', 'Planner A', 'IL009', 9),
('INDIRECT', 'Planner B', 'IL010', 10),
('INDIRECT', 'Procurement Coordinator', 'IL011', 11),
('INDIRECT', 'Project Controls Lead', 'IL012', 12),
('INDIRECT', 'Project Manager', 'IL013', 13),
('INDIRECT', 'QA/QC Inspector A', 'IL014', 14),
('INDIRECT', 'QA/QC Inspector B', 'IL015', 15),
('INDIRECT', 'QA/QC Supervisor', 'IL016', 16),
('INDIRECT', 'Safety Supervisor', 'IL017', 17),
('INDIRECT', 'Safety Technician A', 'IL018', 18),
('INDIRECT', 'Safety Technician B', 'IL019', 19),
('INDIRECT', 'Scheduler', 'IL020', 20),
('INDIRECT', 'Senior Project Manager', 'IL021', 21),
('INDIRECT', 'Superintendent', 'IL022', 22),
('INDIRECT', 'Timekeeper', 'IL023', 23)
ON CONFLICT (code) DO NOTHING;

-- Insert standard disciplines
INSERT INTO public.discipline_registry (name, parent_group, wbs_code_prefix, is_standard) VALUES
('PIPING', 'MECHANICAL', '1.1.9', true),
('STEEL', 'MECHANICAL', '1.1.9', true),
('EQUIPMENT', 'MECHANICAL', '1.1.9', true),
('INSTRUMENTATION', 'I&E', '1.1.10', true),
('ELECTRICAL', 'I&E', '1.1.10', true),
('CIVIL', 'CIVIL', '1.1.8', true),
('CONCRETE', 'CIVIL', '1.1.8', true),
('GROUNDING', 'CIVIL', '1.1.8', true),
('CIVIL - GROUNDING', 'CIVIL', '1.1.8', true),
('FABRICATION', 'GENERAL', '1.1.4', true),
('MILLWRIGHT', 'GENERAL', '1.1.12', true),
('SCAFFOLDING', 'GENERAL', '1.1.2', true),
('CONSTRUCTABILITY', 'GENERAL', '1.1.3', true),
('MOBILIZATION', 'GENERAL', '1.1.5', true),
('CLEAN UP', 'GENERAL', '1.1.6', true),
('BUILDING-REMODELING', 'GENERAL', '1.1.7', true),
('GENERAL STAFFING', 'GENERAL', '1.1.1', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 11. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.labor_categories IS '39 direct and 23 indirect labor categories for 5-level WBS';
COMMENT ON TABLE public.phase_allocations IS 'Indirect labor allocations across 4 project phases';
COMMENT ON TABLE public.discipline_registry IS 'Standard discipline to parent group mappings';
COMMENT ON TABLE public.direct_labor_allocations IS 'Direct labor manhours by discipline and category';
COMMENT ON VIEW v_wbs_rollups IS 'WBS hierarchy rollups with budget totals';

COMMIT;