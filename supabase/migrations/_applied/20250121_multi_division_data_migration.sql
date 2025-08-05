-- Migration: Migrate Existing Data to Multi-Division Structure
-- Description: Migrates existing project data to support multi-division tracking

-- =====================================================
-- PHASE 1: Map Craft Types to Divisions
-- =====================================================

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

  -- Map craft types to divisions based on typical work
  -- Electrical crafts to I&E
  INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
  SELECT id, v_ie_id, true
  FROM craft_types
  WHERE LOWER(name) LIKE '%electric%' 
     OR LOWER(name) LIKE '%instrument%'
     OR code IN ('ELEC', 'INST', 'IE')
  ON CONFLICT (craft_type_id, division_id) DO NOTHING;

  -- Civil/Concrete crafts to Civil
  INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
  SELECT id, v_civil_id, true
  FROM craft_types
  WHERE LOWER(name) LIKE '%civil%'
     OR LOWER(name) LIKE '%concrete%'
     OR LOWER(name) LIKE '%grout%'
     OR code IN ('CIV', 'CONC')
  ON CONFLICT (craft_type_id, division_id) DO NOTHING;

  -- All other trade crafts to Mechanical (default)
  INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
  SELECT ct.id, v_mechanical_id, true
  FROM craft_types ct
  WHERE NOT EXISTS (
    SELECT 1 FROM craft_type_divisions ctd 
    WHERE ctd.craft_type_id = ct.id
  )
  AND ct.code NOT IN ('DIRECT', 'INDIRECT', 'STAFF') -- Exclude category placeholders
  ON CONFLICT (craft_type_id, division_id) DO NOTHING;

  -- Management/Support roles can work across divisions (add as non-primary)
  INSERT INTO craft_type_divisions (craft_type_id, division_id, is_primary)
  SELECT ct.id, d.id, false
  FROM craft_types ct
  CROSS JOIN divisions d
  WHERE LOWER(ct.name) IN ('project manager', 'superintendent', 'general foreman', 
                          'safety tech', 'cost engineer', 'scheduler', 'project controls')
  AND d.is_active = true
  ON CONFLICT (craft_type_id, division_id) DO NOTHING;

END $$;

-- =====================================================
-- PHASE 2: Migrate Budget Breakdowns to Division Budgets
-- =====================================================

-- Create division budgets based on existing project budget breakdowns
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
SELECT 
  pbb.project_id,
  ddm.division_id,
  SUM(CASE WHEN pbb.cost_type = 'Labor' THEN pbb.value ELSE 0 END) as labor_budget,
  SUM(CASE WHEN pbb.cost_type = 'Materials' THEN pbb.value ELSE 0 END) as materials_budget,
  SUM(CASE WHEN pbb.cost_type = 'Equipment' THEN pbb.value ELSE 0 END) as equipment_budget,
  SUM(CASE WHEN pbb.cost_type = 'Subcontracts' THEN pbb.value ELSE 0 END) as subcontracts_budget,
  SUM(CASE WHEN pbb.cost_type NOT IN ('Labor', 'Materials', 'Equipment', 'Subcontracts') 
       THEN pbb.value ELSE 0 END) as other_budget,
  pbb.created_by,
  MIN(pbb.created_at)
FROM project_budget_breakdowns pbb
INNER JOIN division_discipline_mapping ddm ON ddm.discipline_name = pbb.discipline
GROUP BY pbb.project_id, ddm.division_id, pbb.created_by
ON CONFLICT (project_id, division_id) DO UPDATE
SET 
  labor_budget = EXCLUDED.labor_budget,
  materials_budget = EXCLUDED.materials_budget,
  equipment_budget = EXCLUDED.equipment_budget,
  subcontracts_budget = EXCLUDED.subcontracts_budget,
  other_budget = EXCLUDED.other_budget,
  updated_at = now();

-- =====================================================
-- PHASE 3: Update Labor Actuals with Division IDs
-- =====================================================

-- Update labor_actuals based on craft type primary division
UPDATE labor_actuals la
SET division_id = ctd.division_id
FROM craft_type_divisions ctd
WHERE la.craft_type_id = ctd.craft_type_id
AND ctd.is_primary = true
AND la.division_id IS NULL;

-- For any remaining labor_actuals without division, use project's lead division
UPDATE labor_actuals la
SET division_id = pd.division_id
FROM project_divisions pd
WHERE la.project_id = pd.project_id
AND pd.is_lead_division = true
AND la.division_id IS NULL;

-- =====================================================
-- PHASE 4: Update Labor Employee Actuals with Division IDs
-- =====================================================

-- Update labor_employee_actuals based on employee's craft type
UPDATE labor_employee_actuals lea
SET division_id = ctd.division_id
FROM employees e
INNER JOIN craft_type_divisions ctd ON ctd.craft_type_id = e.craft_type_id
WHERE lea.employee_id = e.id
AND ctd.is_primary = true
AND lea.division_id IS NULL;

-- =====================================================
-- PHASE 5: Update Labor Headcount Forecasts
-- =====================================================

-- Update headcount forecasts based on craft type
UPDATE labor_headcount_forecasts lhf
SET division_id = ctd.division_id
FROM craft_type_divisions ctd
WHERE lhf.craft_type_id = ctd.craft_type_id
AND ctd.is_primary = true
AND lhf.division_id IS NULL;

-- =====================================================
-- PHASE 6: Create Initial Division Forecasts
-- =====================================================

-- Create initial division forecasts based on current project data
INSERT INTO division_forecasts (
  project_id,
  division_id,
  forecast_date,
  forecasted_cost,
  cost_to_complete,
  percent_complete,
  notes,
  created_by
)
SELECT DISTINCT
  pd.project_id,
  pd.division_id,
  CURRENT_DATE,
  COALESCE(dcs.total_committed, 0) + COALESCE(db.total_budget * 0.1, 0), -- Estimated 10% contingency
  GREATEST(0, COALESCE(db.total_budget, 0) - COALESCE(dcs.total_committed, 0)),
  CASE 
    WHEN COALESCE(db.total_budget, 0) > 0 
    THEN LEAST(100, (COALESCE(dcs.total_committed, 0) / db.total_budget) * 100)
    ELSE 0 
  END,
  'Initial forecast based on current committed costs',
  p.created_by
FROM project_divisions pd
INNER JOIN projects p ON p.id = pd.project_id
LEFT JOIN division_budgets db ON db.project_id = pd.project_id AND db.division_id = pd.division_id
LEFT JOIN LATERAL (
  SELECT 
    SUM(po.total_amount) + SUM(la.actual_cost_with_burden) as total_committed
  FROM purchase_orders po
  FULL OUTER JOIN labor_actuals la ON la.project_id = po.project_id AND la.division_id = po.division_id
  WHERE COALESCE(po.project_id, la.project_id) = pd.project_id
  AND COALESCE(po.division_id, la.division_id) = pd.division_id
) dcs ON true
WHERE p.status = 'active'
ON CONFLICT (project_id, division_id, forecast_date) DO NOTHING;

-- =====================================================
-- PHASE 7: Update Change Orders
-- =====================================================

-- For existing change orders, assign to project's lead division
UPDATE change_orders co
SET division_id = pd.division_id
FROM project_divisions pd
WHERE co.project_id = pd.project_id
AND pd.is_lead_division = true
AND co.division_id IS NULL;

-- =====================================================
-- PHASE 8: Update Invoices
-- =====================================================

-- Update invoices based on their linked PO's division
UPDATE invoices i
SET division_id = po.division_id
FROM purchase_orders po
WHERE i.purchase_order_id = po.id
AND i.division_id IS NULL
AND po.division_id IS NOT NULL;

-- For invoices without PO link, use project's lead division
UPDATE invoices i
SET division_id = pd.division_id
FROM project_divisions pd
WHERE i.project_id = pd.project_id
AND pd.is_lead_division = true
AND i.division_id IS NULL;

-- =====================================================
-- PHASE 9: Data Validation Queries
-- =====================================================

-- Log migration statistics
DO $$
DECLARE
  v_projects_with_divisions integer;
  v_pos_with_divisions integer;
  v_labor_with_divisions integer;
  v_unmapped_disciplines integer;
  r RECORD;
BEGIN
  -- Count projects with division assignments
  SELECT COUNT(DISTINCT project_id) INTO v_projects_with_divisions
  FROM project_divisions;

  -- Count POs with division assignments
  SELECT COUNT(*) INTO v_pos_with_divisions
  FROM purchase_orders
  WHERE division_id IS NOT NULL;

  -- Count labor actuals with division assignments
  SELECT COUNT(*) INTO v_labor_with_divisions
  FROM labor_actuals
  WHERE division_id IS NOT NULL;

  -- Count unmapped disciplines
  SELECT COUNT(DISTINCT discipline) INTO v_unmapped_disciplines
  FROM project_budget_breakdowns pbb
  WHERE NOT EXISTS (
    SELECT 1 FROM division_discipline_mapping ddm
    WHERE ddm.discipline_name = pbb.discipline
  );

  -- Log results
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Projects with divisions: %', v_projects_with_divisions;
  RAISE NOTICE '- POs with divisions: %', v_pos_with_divisions;
  RAISE NOTICE '- Labor actuals with divisions: %', v_labor_with_divisions;
  RAISE NOTICE '- Unmapped disciplines: %', v_unmapped_disciplines;
  
  -- Log any unmapped disciplines
  IF v_unmapped_disciplines > 0 THEN
    RAISE NOTICE 'Unmapped disciplines:';
    FOR r IN 
      SELECT DISTINCT discipline 
      FROM project_budget_breakdowns pbb
      WHERE NOT EXISTS (
        SELECT 1 FROM division_discipline_mapping ddm
        WHERE ddm.discipline_name = pbb.discipline
      )
    LOOP
      RAISE NOTICE '  - %', r.discipline;
    END LOOP;
  END IF;
END $$;

-- =====================================================
-- PHASE 10: Create Indexes for Performance
-- =====================================================

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_po_project_division ON purchase_orders(project_id, division_id);
CREATE INDEX IF NOT EXISTS idx_labor_project_division ON labor_actuals(project_id, division_id);
CREATE INDEX IF NOT EXISTS idx_co_project_division ON change_orders(project_id, division_id);
CREATE INDEX IF NOT EXISTS idx_invoice_project_division ON invoices(project_id, division_id);

-- Create index for division budget lookups
CREATE INDEX IF NOT EXISTS idx_division_budgets_lookup ON division_budgets(project_id, division_id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA public IS 'Multi-division budget tracking migration completed. Projects can now have multiple divisions with separate budgets, PMs, and cost tracking.';