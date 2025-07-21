-- Migration: Migrate Existing Projects to Multi-Division Structure
-- Description: Converts existing single-division projects to use the new multi-division architecture
-- This migration specifically handles existing project data

-- =====================================================
-- PHASE 1: Migrate Existing Projects to project_divisions
-- =====================================================

-- Create project_divisions entries for existing projects with division assignments
INSERT INTO project_divisions (
  project_id, 
  division_id, 
  division_pm_id,
  is_lead_division, 
  budget_allocated,
  created_by,
  created_at
)
SELECT 
  p.id as project_id,
  p.division_id,
  p.project_manager_id as division_pm_id,
  true as is_lead_division,
  COALESCE(p.original_contract_amount, 0) as budget_allocated,
  p.created_by,
  p.created_at
FROM projects p
WHERE p.division_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_divisions pd 
    WHERE pd.project_id = p.id 
    AND pd.division_id = p.division_id
  );

-- Log projects migrated
DO $$
DECLARE
  v_migrated_count integer;
BEGIN
  SELECT COUNT(*) INTO v_migrated_count
  FROM project_divisions pd
  WHERE pd.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute';
  
  RAISE NOTICE 'Migrated % existing projects to project_divisions', v_migrated_count;
END $$;

-- =====================================================
-- PHASE 2: Assign Division IDs to Purchase Orders
-- =====================================================

-- Method 1: Assign POs based on the creator's division (if they belong to a project division)
UPDATE purchase_orders po
SET division_id = pd.division_id
FROM profiles pr
INNER JOIN project_divisions pd ON pd.division_pm_id = pr.id
WHERE po.created_by = pr.id
  AND po.project_id = pd.project_id
  AND po.division_id IS NULL
  AND pd.is_lead_division = true;

-- Method 2: For remaining POs, use the project's lead division
UPDATE purchase_orders po
SET division_id = pd.division_id
FROM project_divisions pd
WHERE po.project_id = pd.project_id
  AND pd.is_lead_division = true
  AND po.division_id IS NULL;

-- Log PO updates
DO $$
DECLARE
  v_pos_with_divisions integer;
  v_pos_without_divisions integer;
BEGIN
  SELECT COUNT(*) INTO v_pos_with_divisions
  FROM purchase_orders
  WHERE division_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_pos_without_divisions
  FROM purchase_orders
  WHERE division_id IS NULL
    AND project_id IS NOT NULL;
  
  RAISE NOTICE 'POs with divisions: %, POs without divisions: %', 
    v_pos_with_divisions, v_pos_without_divisions;
END $$;

-- =====================================================
-- PHASE 3: Create Division Budgets from Existing Data
-- =====================================================

-- First, ensure we have discipline mappings for common disciplines
INSERT INTO division_discipline_mapping (division_id, discipline_name, created_by)
SELECT 
  d.id,
  disc.discipline,
  (SELECT id FROM profiles WHERE email LIKE '%@ics.ac' LIMIT 1)
FROM (
  SELECT DISTINCT discipline 
  FROM project_budget_breakdowns 
  WHERE discipline IS NOT NULL
) disc
CROSS JOIN divisions d
WHERE (
  -- Electrical disciplines to I&E
  (LOWER(disc.discipline) LIKE '%electric%' OR 
   LOWER(disc.discipline) LIKE '%instrument%' OR
   LOWER(disc.discipline) IN ('i&e', 'i & e', 'instrumentation'))
  AND d.code = 'I&E'
) OR (
  -- Civil disciplines to Civil
  (LOWER(disc.discipline) LIKE '%civil%' OR 
   LOWER(disc.discipline) LIKE '%concrete%' OR
   LOWER(disc.discipline) LIKE '%grout%')
  AND d.code = 'CIV'
) OR (
  -- Everything else to Mechanical
  (LOWER(disc.discipline) NOT LIKE '%electric%' AND 
   LOWER(disc.discipline) NOT LIKE '%instrument%' AND
   LOWER(disc.discipline) NOT LIKE '%civil%' AND
   LOWER(disc.discipline) NOT LIKE '%concrete%' AND
   LOWER(disc.discipline) NOT LIKE '%grout%')
  AND d.code = 'MEC'
)
ON CONFLICT (discipline_name) DO NOTHING;

-- Now create division budgets for projects that don't have them yet
WITH budget_aggregates AS (
  SELECT 
    pbb.project_id,
    ddm.division_id,
    SUM(CASE WHEN pbb.cost_type = 'Labor' THEN pbb.value ELSE 0 END) as labor_budget,
    SUM(CASE WHEN pbb.cost_type = 'Materials' THEN pbb.value ELSE 0 END) as materials_budget,
    SUM(CASE WHEN pbb.cost_type = 'Equipment' THEN pbb.value ELSE 0 END) as equipment_budget,
    SUM(CASE WHEN pbb.cost_type = 'Subcontracts' THEN pbb.value ELSE 0 END) as subcontracts_budget,
    SUM(CASE WHEN pbb.cost_type NOT IN ('Labor', 'Materials', 'Equipment', 'Subcontracts') 
         THEN pbb.value ELSE 0 END) as other_budget,
    MIN(pbb.created_by) as created_by,
    MIN(pbb.created_at) as created_at
  FROM project_budget_breakdowns pbb
  INNER JOIN division_discipline_mapping ddm ON ddm.discipline_name = pbb.discipline
  INNER JOIN project_divisions pd ON pd.project_id = pbb.project_id AND pd.division_id = ddm.division_id
  GROUP BY pbb.project_id, ddm.division_id
)
INSERT INTO division_budgets (
  project_id,
  division_id,
  labor_budget,
  materials_budget,
  equipment_budget,
  subcontracts_budget,
  other_budget,
  created_by,
  created_at
)
SELECT * FROM budget_aggregates
WHERE NOT EXISTS (
  SELECT 1 FROM division_budgets db
  WHERE db.project_id = budget_aggregates.project_id
    AND db.division_id = budget_aggregates.division_id
);

-- For projects without budget breakdowns, create a simple division budget from contract value
INSERT INTO division_budgets (
  project_id,
  division_id,
  labor_budget,
  materials_budget,
  equipment_budget,
  subcontracts_budget,
  other_budget,
  created_by
)
SELECT 
  pd.project_id,
  pd.division_id,
  pd.budget_allocated * 0.4 as labor_budget, -- Assume 40% labor
  pd.budget_allocated * 0.3 as materials_budget, -- 30% materials
  pd.budget_allocated * 0.1 as equipment_budget, -- 10% equipment
  pd.budget_allocated * 0.15 as subcontracts_budget, -- 15% subcontracts
  pd.budget_allocated * 0.05 as other_budget, -- 5% other
  pd.created_by
FROM project_divisions pd
WHERE pd.budget_allocated > 0
  AND NOT EXISTS (
    SELECT 1 FROM division_budgets db
    WHERE db.project_id = pd.project_id
      AND db.division_id = pd.division_id
  );

-- =====================================================
-- PHASE 4: Update Financial Snapshots
-- =====================================================

-- Ensure financial snapshots are recalculated for affected projects
INSERT INTO financial_snapshots (
  project_id,
  snapshot_date,
  original_contract,
  approved_cos,
  revised_contract,
  committed_costs,
  actual_costs,
  forecasted_costs,
  percent_complete,
  created_by
)
SELECT DISTINCT
  pd.project_id,
  CURRENT_DATE,
  p.original_contract_amount,
  COALESCE(co_sum.total_approved, 0),
  p.original_contract_amount + COALESCE(co_sum.total_approved, 0),
  COALESCE(po_sum.total_committed, 0),
  COALESCE(la_sum.total_actual, 0),
  COALESCE(po_sum.total_committed, 0) + COALESCE(la_sum.total_actual, 0),
  CASE 
    WHEN p.original_contract_amount > 0 
    THEN LEAST(100, (COALESCE(la_sum.total_actual, 0) / p.original_contract_amount) * 100)
    ELSE 0 
  END,
  pd.created_by
FROM project_divisions pd
INNER JOIN projects p ON p.id = pd.project_id
LEFT JOIN (
  SELECT project_id, SUM(amount) as total_approved
  FROM change_orders
  WHERE status = 'approved'
  GROUP BY project_id
) co_sum ON co_sum.project_id = pd.project_id
LEFT JOIN (
  SELECT project_id, SUM(total_amount) as total_committed
  FROM purchase_orders
  WHERE status = 'active'
  GROUP BY project_id
) po_sum ON po_sum.project_id = pd.project_id
LEFT JOIN (
  SELECT project_id, SUM(actual_cost) as total_actual
  FROM labor_actuals
  GROUP BY project_id
) la_sum ON la_sum.project_id = pd.project_id
WHERE p.status IN ('active', 'planning')
  AND pd.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
ON CONFLICT (project_id, snapshot_date) DO UPDATE
SET 
  approved_cos = EXCLUDED.approved_cos,
  revised_contract = EXCLUDED.revised_contract,
  committed_costs = EXCLUDED.committed_costs,
  actual_costs = EXCLUDED.actual_costs,
  forecasted_costs = EXCLUDED.forecasted_costs,
  percent_complete = EXCLUDED.percent_complete,
  updated_at = now();

-- =====================================================
-- PHASE 5: Final Validation
-- =====================================================

DO $$
DECLARE
  v_projects_total integer;
  v_projects_with_divisions integer;
  v_projects_without_divisions integer;
  v_divisions_with_budgets integer;
  v_pos_assigned integer;
  v_labor_assigned integer;
BEGIN
  -- Count total active projects
  SELECT COUNT(*) INTO v_projects_total
  FROM projects
  WHERE deleted_at IS NULL
    AND status NOT IN ('cancelled', 'completed');

  -- Count projects with division assignments
  SELECT COUNT(DISTINCT project_id) INTO v_projects_with_divisions
  FROM project_divisions;

  -- Count projects without divisions
  SELECT COUNT(*) INTO v_projects_without_divisions
  FROM projects p
  WHERE deleted_at IS NULL
    AND status NOT IN ('cancelled', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM project_divisions pd
      WHERE pd.project_id = p.id
    );

  -- Count divisions with budgets
  SELECT COUNT(*) INTO v_divisions_with_budgets
  FROM division_budgets;

  -- Count POs with division assignments
  SELECT COUNT(*) INTO v_pos_assigned
  FROM purchase_orders
  WHERE division_id IS NOT NULL;

  -- Count labor records with division assignments
  SELECT COUNT(*) INTO v_labor_assigned
  FROM labor_actuals
  WHERE division_id IS NOT NULL;

  RAISE NOTICE '===== Migration Summary =====';
  RAISE NOTICE 'Total active projects: %', v_projects_total;
  RAISE NOTICE 'Projects with divisions: %', v_projects_with_divisions;
  RAISE NOTICE 'Projects without divisions: %', v_projects_without_divisions;
  RAISE NOTICE 'Division budgets created: %', v_divisions_with_budgets;
  RAISE NOTICE 'POs with divisions: %', v_pos_assigned;
  RAISE NOTICE 'Labor records with divisions: %', v_labor_assigned;
  RAISE NOTICE '============================';

  -- List any projects without divisions
  IF v_projects_without_divisions > 0 THEN
    RAISE NOTICE 'Projects without division assignments:';
    FOR r IN 
      SELECT p.job_number, p.name
      FROM projects p
      WHERE deleted_at IS NULL
        AND status NOT IN ('cancelled', 'completed')
        AND NOT EXISTS (
          SELECT 1 FROM project_divisions pd
          WHERE pd.project_id = p.id
        )
      LIMIT 10
    LOOP
      RAISE NOTICE '  - % - %', r.job_number, r.name;
    END LOOP;
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA public IS 'Existing projects migrated to multi-division structure. Projects can now track budgets and costs across multiple divisions.';