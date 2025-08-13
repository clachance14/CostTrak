-- Migration to backfill per diem costs and update calculation views
-- This ensures per diem costs are properly captured in project financials

-- 1. Backfill per diem costs for all projects with per diem enabled
DO $$
DECLARE
  project_record RECORD;
  result JSON;
BEGIN
  -- Loop through all projects with per diem enabled
  FOR project_record IN 
    SELECT id, name, job_number, per_diem_rate_direct, per_diem_rate_indirect
    FROM public.projects
    WHERE per_diem_enabled = true
  LOOP
    -- Recalculate per diem for each project
    SELECT recalculate_project_per_diem(project_record.id) INTO result;
    
    RAISE NOTICE 'Project % (%): %', 
      project_record.name, 
      project_record.job_number,
      result;
  END LOOP;
END $$;

-- 2. Create or replace view to include per diem in labor cost calculations
CREATE OR REPLACE VIEW public.labor_costs_with_per_diem AS
SELECT 
  p.id AS project_id,
  p.name AS project_name,
  p.job_number,
  -- Labor costs from actuals
  COALESCE(SUM(lea.total_cost_with_burden), 0) AS labor_actual_cost,
  -- Per diem costs
  COALESCE(pd.total_per_diem, 0) AS per_diem_cost,
  -- Total labor cost including per diem
  COALESCE(SUM(lea.total_cost_with_burden), 0) + COALESCE(pd.total_per_diem, 0) AS total_labor_cost,
  -- Labor hours
  COALESCE(SUM(lea.total_hours), 0) AS total_hours,
  -- Average rate including per diem
  CASE 
    WHEN SUM(lea.total_hours) > 0 THEN 
      (COALESCE(SUM(lea.total_cost_with_burden), 0) + COALESCE(pd.total_per_diem, 0)) / SUM(lea.total_hours)
    ELSE 0 
  END AS average_rate_with_per_diem
FROM public.projects p
LEFT JOIN public.labor_employee_actuals lea ON p.id = lea.project_id
LEFT JOIN (
  SELECT 
    project_id,
    SUM(amount) AS total_per_diem
  FROM public.per_diem_costs
  GROUP BY project_id
) pd ON p.id = pd.project_id
GROUP BY p.id, p.name, p.job_number, pd.total_per_diem;

-- 3. Create function to get total labor cost including per diem
CREATE OR REPLACE FUNCTION get_total_labor_cost(p_project_id UUID)
RETURNS TABLE(
  labor_cost DECIMAL(10,2),
  per_diem_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(lea.total_cost_with_burden), 0)::DECIMAL(10,2) AS labor_cost,
    COALESCE((
      SELECT SUM(amount) 
      FROM public.per_diem_costs 
      WHERE project_id = p_project_id
    ), 0)::DECIMAL(10,2) AS per_diem_cost,
    (COALESCE(SUM(lea.total_cost_with_burden), 0) + 
     COALESCE((
       SELECT SUM(amount) 
       FROM public.per_diem_costs 
       WHERE project_id = p_project_id
     ), 0))::DECIMAL(10,2) AS total_cost
  FROM public.labor_employee_actuals lea
  WHERE lea.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update project summary view to include per diem
CREATE OR REPLACE VIEW public.project_financial_summary AS
SELECT 
  p.id,
  p.name,
  p.job_number,
  p.original_contract,
  p.revised_contract,
  p.total_labor_budget,
  p.materials_budget,
  p.equipment_budget,
  p.subcontracts_budget,
  p.small_tools_budget,
  -- Labor costs with per diem
  lc.labor_actual_cost,
  lc.per_diem_cost,
  lc.total_labor_cost,
  -- PO costs
  COALESCE(po.total_po_amount, 0) AS total_po_committed,
  COALESCE(po.total_invoiced, 0) AS total_po_invoiced,
  -- Total actual costs
  lc.total_labor_cost + COALESCE(po.total_invoiced, 0) AS total_actual_cost,
  -- Total committed costs
  lc.total_labor_cost + COALESCE(po.total_po_amount, 0) AS total_committed_cost,
  -- Budget remaining
  (p.total_labor_budget + p.materials_budget + p.equipment_budget + 
   p.subcontracts_budget + p.small_tools_budget) - 
  (lc.total_labor_cost + COALESCE(po.total_invoiced, 0)) AS budget_remaining
FROM public.projects p
LEFT JOIN public.labor_costs_with_per_diem lc ON p.id = lc.project_id
LEFT JOIN (
  SELECT 
    project_id,
    SUM(committed_amount) AS total_po_amount,
    SUM(invoiced_amount) AS total_invoiced
  FROM public.purchase_orders
  WHERE status = 'approved'
  GROUP BY project_id
) po ON p.id = po.project_id;

-- 5. Grant appropriate permissions
GRANT SELECT ON public.labor_costs_with_per_diem TO authenticated;
GRANT SELECT ON public.project_financial_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_labor_cost TO authenticated;

-- Add comments for documentation
COMMENT ON VIEW public.labor_costs_with_per_diem IS 'Labor costs including per diem for accurate project cost tracking';
COMMENT ON VIEW public.project_financial_summary IS 'Complete project financial summary including per diem in labor costs';
COMMENT ON FUNCTION get_total_labor_cost IS 'Returns total labor cost including per diem for a project';

-- 6. Log the migration (if audit_log table exists)
DO $$
BEGIN
  -- Check if audit_log table exists and has the expected columns
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    -- Try to insert with the columns that exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_log' 
      AND column_name = 'entity_type'
    ) THEN
      -- Use entity_type structure
      INSERT INTO public.audit_log (
        entity_type,
        entity_id,
        action,
        changes,
        performed_by
      ) VALUES (
        'system',
        gen_random_uuid(),
        'backfill_per_diem',
        jsonb_build_object(
          'description', 'Backfilled per diem costs and updated calculation views',
          'timestamp', NOW()
        ),
        auth.uid()
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If audit log fails, just continue
    RAISE NOTICE 'Audit log entry skipped: %', SQLERRM;
END $$;

-- Summary message
DO $$
DECLARE
  total_per_diem DECIMAL(10,2);
  project_count INTEGER;
BEGIN
  SELECT 
    COUNT(DISTINCT project_id),
    SUM(amount)
  INTO project_count, total_per_diem
  FROM public.per_diem_costs;
  
  RAISE NOTICE '✅ Per diem backfill complete!';
  RAISE NOTICE '   Projects with per diem: %', project_count;
  RAISE NOTICE '   Total per diem amount: $%', total_per_diem;
END $$;