-- Migration: Add Multi-Division Budget Tracking Support
-- Description: Enables projects to have multiple divisions with separate budgets, PMs, and cost tracking

-- =====================================================
-- PHASE 1: Core Division Support Tables
-- =====================================================

-- Create project_divisions junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS project_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  division_pm_id uuid REFERENCES profiles(id),
  is_lead_division boolean DEFAULT false,
  budget_allocated numeric DEFAULT 0 CHECK (budget_allocated >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(project_id, division_id)
);

-- Ensure only one lead division per project
CREATE UNIQUE INDEX idx_one_lead_division_per_project 
ON project_divisions(project_id) 
WHERE is_lead_division = true;

-- Create division_discipline_mapping table
CREATE TABLE IF NOT EXISTS division_discipline_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id),
  discipline_name varchar NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(discipline_name)
);

-- Create craft_type_divisions table
CREATE TABLE IF NOT EXISTS craft_type_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  craft_type_id uuid NOT NULL REFERENCES craft_types(id),
  division_id uuid NOT NULL REFERENCES divisions(id),
  is_primary boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(craft_type_id, division_id)
);

-- Create index for primary division lookup
CREATE INDEX idx_primary_craft_division 
ON craft_type_divisions(craft_type_id) 
WHERE is_primary = true;

-- =====================================================
-- PHASE 2: Add Division Support to Cost Tracking Tables
-- =====================================================

-- Add division_id to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

CREATE INDEX idx_purchase_orders_division ON purchase_orders(division_id);

-- Add division_id to change_orders
ALTER TABLE change_orders 
ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

CREATE INDEX idx_change_orders_division ON change_orders(division_id);

-- Add division_id to labor_actuals
ALTER TABLE labor_actuals 
ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

CREATE INDEX idx_labor_actuals_division ON labor_actuals(division_id);

-- Add division_id to labor_headcount_forecasts
ALTER TABLE labor_headcount_forecasts 
ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

CREATE INDEX idx_labor_headcount_division ON labor_headcount_forecasts(division_id);

-- Add division_id to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

CREATE INDEX idx_invoices_division ON invoices(division_id);

-- Add division_id to labor_employee_actuals
ALTER TABLE labor_employee_actuals 
ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES divisions(id);

CREATE INDEX idx_labor_employee_actuals_division ON labor_employee_actuals(division_id);

-- =====================================================
-- PHASE 3: Enhanced Financial Tracking Tables
-- =====================================================

-- Create division_budgets table
CREATE TABLE IF NOT EXISTS division_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  labor_budget numeric DEFAULT 0 CHECK (labor_budget >= 0),
  materials_budget numeric DEFAULT 0 CHECK (materials_budget >= 0),
  equipment_budget numeric DEFAULT 0 CHECK (equipment_budget >= 0),
  subcontracts_budget numeric DEFAULT 0 CHECK (subcontracts_budget >= 0),
  other_budget numeric DEFAULT 0 CHECK (other_budget >= 0),
  other_budget_description text,
  total_budget numeric GENERATED ALWAYS AS (
    COALESCE(labor_budget, 0) + 
    COALESCE(materials_budget, 0) + 
    COALESCE(equipment_budget, 0) + 
    COALESCE(subcontracts_budget, 0) + 
    COALESCE(other_budget, 0)
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(project_id, division_id)
);

CREATE INDEX idx_division_budgets_project ON division_budgets(project_id);

-- Create division_forecasts table
CREATE TABLE IF NOT EXISTS division_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  forecast_date date NOT NULL DEFAULT CURRENT_DATE,
  forecasted_cost numeric DEFAULT 0 CHECK (forecasted_cost >= 0),
  cost_to_complete numeric DEFAULT 0 CHECK (cost_to_complete >= 0),
  percent_complete numeric DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, division_id, forecast_date)
);

CREATE INDEX idx_division_forecasts_date ON division_forecasts(forecast_date);

-- =====================================================
-- PHASE 4: Populate Division Mapping Data
-- =====================================================

-- Get the division IDs
DO $$
DECLARE
  v_mechanical_id uuid;
  v_ie_id uuid;
  v_civil_id uuid;
BEGIN
  -- Get division IDs
  SELECT id INTO v_mechanical_id FROM divisions WHERE code = 'MEC';
  SELECT id INTO v_ie_id FROM divisions WHERE code = 'I&E';
  SELECT id INTO v_civil_id FROM divisions WHERE code = 'CIV';

  -- Insert discipline to division mappings
  INSERT INTO division_discipline_mapping (division_id, discipline_name) VALUES
    (v_ie_id, 'ELECTRICAL'),
    (v_ie_id, 'INSTRUMENTATION'),
    (v_ie_id, 'INSTRUMENTATION DEMO'),
    (v_civil_id, 'CIVIL - GROUNDING'),
    (v_civil_id, 'GROUTING'),
    (v_mechanical_id, 'FABRICATION'),
    (v_mechanical_id, 'PIPING'),
    (v_mechanical_id, 'PIPING DEMO'),
    (v_mechanical_id, 'EQUIPMENT'),
    (v_mechanical_id, 'EQUIPMENT DEMO'),
    (v_mechanical_id, 'STEEL'),
    (v_mechanical_id, 'STEEL DEMO'),
    (v_mechanical_id, 'SCAFFOLDING'),
    (v_mechanical_id, 'BUILDING-REMODELING'),
    (v_mechanical_id, 'CONSTRUCTABILITY'),
    (v_mechanical_id, 'GENERAL STAFFING')
  ON CONFLICT (discipline_name) DO NOTHING;
END $$;

-- =====================================================
-- PHASE 5: Migrate Existing Data
-- =====================================================

-- Create project_divisions entries for existing projects
INSERT INTO project_divisions (project_id, division_id, division_pm_id, is_lead_division, budget_allocated)
SELECT 
  p.id,
  p.division_id,
  p.project_manager_id,
  true, -- Set existing division as lead
  p.revised_contract
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_divisions pd 
  WHERE pd.project_id = p.id AND pd.division_id = p.division_id
);

-- Update purchase_orders division based on created_by user's division
UPDATE purchase_orders po
SET division_id = p.division_id
FROM profiles p
WHERE po.created_by = p.id
AND po.division_id IS NULL
AND p.division_id IS NOT NULL;

-- For POs created by users without divisions, use project's lead division
UPDATE purchase_orders po
SET division_id = pd.division_id
FROM project_divisions pd
WHERE po.project_id = pd.project_id
AND pd.is_lead_division = true
AND po.division_id IS NULL;

-- Update labor_actuals based on craft type mapping (this will be done after craft mappings are set up)
-- Placeholder for now - will be updated once craft_type_divisions are populated

-- =====================================================
-- PHASE 6: Create Views for Division Analysis
-- =====================================================

-- Create view for division cost summary
CREATE OR REPLACE VIEW division_cost_summary AS
SELECT 
  p.id as project_id,
  p.job_number,
  p.name as project_name,
  d.id as division_id,
  d.name as division_name,
  d.code as division_code,
  -- Budget
  COALESCE(db.total_budget, 0) as division_budget,
  -- PO Costs
  COALESCE(SUM(po.total_amount), 0) as total_po_committed,
  COALESCE(SUM(po.invoiced_amount), 0) as total_po_invoiced,
  -- Labor Costs
  COALESCE(SUM(la.actual_cost_with_burden), 0) as total_labor_cost,
  COALESCE(SUM(la.actual_hours), 0) as total_labor_hours,
  -- Change Orders
  COALESCE(SUM(CASE WHEN co.status = 'approved' THEN co.amount ELSE 0 END), 0) as approved_change_orders,
  -- Total Committed
  COALESCE(SUM(po.total_amount), 0) + 
  COALESCE(SUM(la.actual_cost_with_burden), 0) as total_committed,
  -- Variance
  COALESCE(db.total_budget, 0) - (
    COALESCE(SUM(po.total_amount), 0) + 
    COALESCE(SUM(la.actual_cost_with_burden), 0)
  ) as budget_variance
FROM projects p
INNER JOIN project_divisions pd ON pd.project_id = p.id
INNER JOIN divisions d ON d.id = pd.division_id
LEFT JOIN division_budgets db ON db.project_id = p.id AND db.division_id = d.id
LEFT JOIN purchase_orders po ON po.project_id = p.id AND po.division_id = d.id
LEFT JOIN labor_actuals la ON la.project_id = p.id AND la.division_id = d.id
LEFT JOIN change_orders co ON co.project_id = p.id AND co.division_id = d.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.job_number, p.name, d.id, d.name, d.code, db.total_budget;

-- =====================================================
-- PHASE 7: Create Trigger Functions
-- =====================================================

-- Function to update project totals from division budgets
CREATE OR REPLACE FUNCTION update_project_totals_from_divisions()
RETURNS TRIGGER AS $$
BEGIN
  -- Update project revised_contract based on sum of division budgets
  UPDATE projects p
  SET 
    revised_contract = (
      SELECT COALESCE(SUM(db.total_budget), 0)
      FROM division_budgets db
      WHERE db.project_id = p.id
    ),
    updated_at = now()
  WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to division_budgets table
CREATE TRIGGER update_project_on_division_budget_change
AFTER INSERT OR UPDATE OR DELETE ON division_budgets
FOR EACH ROW EXECUTE FUNCTION update_project_totals_from_divisions();

-- Function to auto-assign division to new records based on user
CREATE OR REPLACE FUNCTION auto_assign_division_from_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If division_id is not set, use the creating user's division
  IF NEW.division_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT division_id INTO NEW.division_id
    FROM profiles
    WHERE id = NEW.created_by;
  END IF;
  
  -- If still null and project-based, use project's lead division
  IF NEW.division_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT division_id INTO NEW.division_id
    FROM project_divisions
    WHERE project_id = NEW.project_id
    AND is_lead_division = true
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-assign trigger to relevant tables
CREATE TRIGGER auto_assign_po_division
BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION auto_assign_division_from_user();

CREATE TRIGGER auto_assign_co_division
BEFORE INSERT ON change_orders
FOR EACH ROW EXECUTE FUNCTION auto_assign_division_from_user();

-- =====================================================
-- PHASE 8: Update timestamps trigger
-- =====================================================

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
CREATE TRIGGER update_project_divisions_updated_at
BEFORE UPDATE ON project_divisions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_division_budgets_updated_at
BEFORE UPDATE ON division_budgets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_division_forecasts_updated_at
BEFORE UPDATE ON division_forecasts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PHASE 9: Grant Permissions
-- =====================================================

-- Grant permissions to authenticated users
GRANT ALL ON project_divisions TO authenticated;
GRANT ALL ON division_discipline_mapping TO authenticated;
GRANT ALL ON craft_type_divisions TO authenticated;
GRANT ALL ON division_budgets TO authenticated;
GRANT ALL ON division_forecasts TO authenticated;
GRANT SELECT ON division_cost_summary TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE project_divisions IS 'Junction table linking projects to multiple divisions with division-specific PMs and budgets';
COMMENT ON TABLE division_discipline_mapping IS 'Maps discipline names from budget breakdowns to divisions';
COMMENT ON TABLE craft_type_divisions IS 'Associates craft types with their primary and secondary divisions';
COMMENT ON TABLE division_budgets IS 'Division-specific budget allocations within a project';
COMMENT ON TABLE division_forecasts IS 'Division-level cost forecasts and completion tracking';
COMMENT ON VIEW division_cost_summary IS 'Aggregated view of costs and budgets by project and division';