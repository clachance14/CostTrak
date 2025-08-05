-- Implement simple WBS structure for the 7 budget categories
-- This creates a clean mapping: L-xxx for Labor, N-xxx for Non-Labor

-- 1. Clean up existing WBS columns (keep only wbs_code)
ALTER TABLE budget_line_items 
DROP COLUMN IF EXISTS wbs_level1,
DROP COLUMN IF EXISTS wbs_level2,
DROP COLUMN IF EXISTS wbs_level3,
DROP COLUMN IF EXISTS wbs_level4,
DROP COLUMN IF EXISTS wbs_level5;

-- 2. Drop and recreate WBS structure table with simple design
DROP TABLE IF EXISTS wbs_structure CASCADE;

CREATE TABLE wbs_structure (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(10) UNIQUE NOT NULL,
  category varchar(20) NOT NULL CHECK (category IN ('LABOR', 'NON_LABOR')),
  description varchar(100) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Insert the 7 standard WBS codes
INSERT INTO wbs_structure (code, category, description, sort_order) VALUES
('L-001', 'LABOR', 'Direct Labor', 1),
('L-002', 'LABOR', 'Indirect Labor', 2),
('L-003', 'LABOR', 'Staff Labor', 3),
('N-001', 'NON_LABOR', 'Materials', 4),
('N-002', 'NON_LABOR', 'Equipment', 5),
('N-003', 'NON_LABOR', 'Subcontracts', 6),
('N-004', 'NON_LABOR', 'Small Tools & Consumables', 7);

-- 4. Add indexes for performance
CREATE INDEX idx_wbs_structure_code ON wbs_structure(code);
CREATE INDEX idx_wbs_structure_category ON wbs_structure(category);
CREATE INDEX idx_wbs_structure_sort_order ON wbs_structure(sort_order);

-- 5. Create simplified budget summary view by WBS
CREATE OR REPLACE VIEW budget_summary_by_wbs AS
SELECT 
  p.id as project_id,
  p.job_number,
  p.name as project_name,
  ws.code as wbs_code,
  ws.description as wbs_description,
  ws.category as wbs_category,
  ws.sort_order,
  COUNT(DISTINCT bli.id) as line_item_count,
  COALESCE(SUM(bli.labor_direct_cost), 0) as labor_direct_total,
  COALESCE(SUM(bli.labor_indirect_cost), 0) as labor_indirect_total,
  COALESCE(SUM(bli.labor_staff_cost), 0) as labor_staff_total,
  COALESCE(SUM(bli.materials_cost), 0) as materials_total,
  COALESCE(SUM(bli.equipment_cost), 0) as equipment_total,
  COALESCE(SUM(bli.subcontracts_cost), 0) as subcontracts_total,
  COALESCE(SUM(bli.small_tools_cost), 0) as small_tools_total,
  COALESCE(SUM(bli.total_cost), 0) as total_budget,
  COALESCE(SUM(bli.manhours), 0) as total_manhours
FROM projects p
CROSS JOIN wbs_structure ws
LEFT JOIN budget_line_items bli ON p.id = bli.project_id AND bli.wbs_code = ws.code
GROUP BY p.id, p.job_number, p.name, ws.code, ws.description, ws.category, ws.sort_order
ORDER BY p.job_number, ws.sort_order;

-- 6. Create a view for budget summary by discipline and WBS
CREATE OR REPLACE VIEW budget_summary_by_discipline_wbs AS
SELECT 
  bli.project_id,
  bli.discipline,
  ws.code as wbs_code,
  ws.description as wbs_description,
  ws.category as wbs_category,
  COUNT(*) as line_item_count,
  SUM(bli.labor_direct_cost) as labor_direct_total,
  SUM(bli.labor_indirect_cost) as labor_indirect_total,
  SUM(bli.labor_staff_cost) as labor_staff_total,
  SUM(bli.materials_cost) as materials_total,
  SUM(bli.equipment_cost) as equipment_total,
  SUM(bli.subcontracts_cost) as subcontracts_total,
  SUM(bli.small_tools_cost) as small_tools_total,
  SUM(bli.total_cost) as total_budget,
  SUM(bli.manhours) as total_manhours
FROM budget_line_items bli
LEFT JOIN wbs_structure ws ON bli.wbs_code = ws.code
WHERE bli.discipline IS NOT NULL
GROUP BY bli.project_id, bli.discipline, ws.code, ws.description, ws.category, ws.sort_order
ORDER BY bli.discipline, ws.sort_order;

-- 7. Add RLS policies for wbs_structure table
ALTER TABLE wbs_structure ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view WBS structure (it's standard across all projects)
CREATE POLICY "All users can view WBS structure" ON wbs_structure
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify WBS structure (though it should rarely change)
CREATE POLICY "Only admins can modify WBS structure" ON wbs_structure
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 8. Add trigger to update updated_at
CREATE TRIGGER update_wbs_structure_updated_at
  BEFORE UPDATE ON wbs_structure
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Add comments for documentation
COMMENT ON TABLE wbs_structure IS 'Simple WBS codes for the 7 standard budget categories';
COMMENT ON COLUMN wbs_structure.code IS 'WBS code: L-xxx for Labor, N-xxx for Non-Labor';
COMMENT ON COLUMN wbs_structure.category IS 'Main category: LABOR or NON_LABOR';
COMMENT ON COLUMN wbs_structure.description IS 'Human-readable description of the WBS code';
COMMENT ON COLUMN wbs_structure.sort_order IS 'Display order for consistent reporting';

COMMENT ON VIEW budget_summary_by_wbs IS 'Budget totals grouped by WBS code for each project';
COMMENT ON VIEW budget_summary_by_discipline_wbs IS 'Budget totals grouped by discipline and WBS code';

-- 10. Update any existing budget_line_items to use simple WBS codes based on their category/subcategory
-- This is a one-time data migration for any existing records
UPDATE budget_line_items 
SET wbs_code = CASE
  WHEN category = 'LABOR' AND subcategory = 'DIRECT' THEN 'L-001'
  WHEN category = 'LABOR' AND subcategory = 'INDIRECT' THEN 'L-002'
  WHEN category = 'LABOR' AND subcategory = 'STAFF' THEN 'L-003'
  WHEN category = 'NON_LABOR' AND subcategory = 'MATERIALS' THEN 'N-001'
  WHEN category = 'NON_LABOR' AND subcategory = 'EQUIPMENT' THEN 'N-002'
  WHEN category = 'NON_LABOR' AND subcategory = 'SUBCONTRACTS' THEN 'N-003'
  WHEN category = 'NON_LABOR' AND subcategory = 'SMALL_TOOLS' THEN 'N-004'
  ELSE wbs_code -- Keep existing if it doesn't match our patterns
END
WHERE wbs_code IS NULL OR wbs_code NOT IN ('L-001','L-002','L-003','N-001','N-002','N-003','N-004');