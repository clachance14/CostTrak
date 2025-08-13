-- Complete Fix for Per Diem to match actual database schema
-- This handles the view dependency issue

-- Step 1: Drop the view that depends on work_date
DROP VIEW IF EXISTS public.per_diem_summary CASCADE;

-- Step 2: Drop existing trigger and function
DROP TRIGGER IF EXISTS calculate_per_diem_on_labor_actual ON public.labor_employee_actuals;
DROP FUNCTION IF EXISTS calculate_per_diem_for_labor_actual() CASCADE;

-- Step 3: The work_date column is already DATE type, so no need to alter it

-- Step 4: Create the corrected trigger function
CREATE OR REPLACE FUNCTION calculate_per_diem_for_labor_actual()
RETURNS TRIGGER AS $$
DECLARE
  v_project_per_diem_enabled BOOLEAN;
  v_per_diem_rate_direct DECIMAL(10,2);
  v_per_diem_rate_indirect DECIMAL(10,2);
  v_employee_category VARCHAR(20);
  v_rate_to_apply DECIMAL(10,2);
BEGIN
  -- Check if per diem is enabled for this project
  SELECT per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect
  INTO v_project_per_diem_enabled, v_per_diem_rate_direct, v_per_diem_rate_indirect
  FROM public.projects
  WHERE id = NEW.project_id;
  
  -- Exit if per diem is not enabled
  IF NOT v_project_per_diem_enabled THEN
    RETURN NEW;
  END IF;
  
  -- Get employee category
  SELECT category
  INTO v_employee_category
  FROM public.employees
  WHERE id = NEW.employee_id;
  
  -- Determine rate to apply (Staff treated as Indirect)
  IF v_employee_category = 'Direct' THEN
    v_rate_to_apply := v_per_diem_rate_direct;
  ELSE
    v_rate_to_apply := v_per_diem_rate_indirect;
  END IF;
  
  -- Skip if rate is zero or no hours worked
  IF v_rate_to_apply = 0 OR COALESCE(NEW.st_hours, 0) + COALESCE(NEW.ot_hours, 0) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Insert or update per diem cost
  -- Using week_ending as the work_date since labor is tracked weekly
  INSERT INTO public.per_diem_costs (
    project_id,
    employee_id,
    work_date,
    employee_type,
    rate_applied,
    days_worked,
    amount,
    labor_actual_id,
    pay_period_ending
  ) VALUES (
    NEW.project_id,
    NEW.employee_id,
    NEW.week_ending::date,
    CASE WHEN v_employee_category = 'Direct' THEN 'Direct' ELSE 'Indirect' END,
    v_rate_to_apply,
    5.00,  -- Assume 5 days per week for weekly labor
    v_rate_to_apply * 5.00,  -- Weekly per diem
    NEW.id,
    NEW.pay_period_ending
  )
  ON CONFLICT (project_id, employee_id, work_date)
  DO UPDATE SET
    rate_applied = EXCLUDED.rate_applied,
    days_worked = EXCLUDED.days_worked,
    amount = EXCLUDED.amount,
    labor_actual_id = EXCLUDED.labor_actual_id,
    pay_period_ending = EXCLUDED.pay_period_ending,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Recreate trigger
CREATE TRIGGER calculate_per_diem_on_labor_actual
  AFTER INSERT OR UPDATE ON public.labor_employee_actuals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_per_diem_for_labor_actual();

-- Step 6: Update recalculation function
CREATE OR REPLACE FUNCTION recalculate_project_per_diem(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_calculated INTEGER := 0;
  v_total_amount DECIMAL(10,2) := 0;
  v_project_per_diem_enabled BOOLEAN;
  v_per_diem_rate_direct DECIMAL(10,2);
  v_per_diem_rate_indirect DECIMAL(10,2);
BEGIN
  -- Check if per diem is enabled
  SELECT per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect
  INTO v_project_per_diem_enabled, v_per_diem_rate_direct, v_per_diem_rate_indirect
  FROM public.projects
  WHERE id = p_project_id;
  
  IF NOT v_project_per_diem_enabled THEN
    RETURN json_build_object(
      'project_id', p_project_id,
      'records_processed', 0,
      'total_per_diem_amount', 0,
      'recalculated_at', NOW(),
      'message', 'Per diem is not enabled for this project'
    );
  END IF;

  -- Delete existing per diem costs
  DELETE FROM public.per_diem_costs
  WHERE project_id = p_project_id;
  
  -- Insert per diem for all labor records with hours
  INSERT INTO public.per_diem_costs (
    project_id,
    employee_id,
    work_date,
    employee_type,
    rate_applied,
    days_worked,
    amount,
    labor_actual_id,
    pay_period_ending
  )
  SELECT 
    la.project_id,
    la.employee_id,
    la.week_ending::date,
    CASE WHEN e.category = 'Direct' THEN 'Direct' ELSE 'Indirect' END,
    CASE WHEN e.category = 'Direct' THEN v_per_diem_rate_direct ELSE v_per_diem_rate_indirect END,
    5.00,  -- 5 days per week
    CASE WHEN e.category = 'Direct' THEN v_per_diem_rate_direct * 5 ELSE v_per_diem_rate_indirect * 5 END,
    la.id,
    la.pay_period_ending
  FROM public.labor_employee_actuals la
  JOIN public.employees e ON e.id = la.employee_id
  WHERE la.project_id = p_project_id
    AND (COALESCE(la.st_hours, 0) + COALESCE(la.ot_hours, 0)) > 0
    AND (
      (e.category = 'Direct' AND v_per_diem_rate_direct > 0) OR
      (e.category IN ('Indirect', 'Staff') AND v_per_diem_rate_indirect > 0)
    );
  
  GET DIAGNOSTICS v_total_calculated = ROW_COUNT;
  
  -- Get total amount
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_amount
  FROM public.per_diem_costs
  WHERE project_id = p_project_id;
  
  RETURN json_build_object(
    'project_id', p_project_id,
    'records_processed', v_total_calculated,
    'total_per_diem_amount', v_total_amount,
    'recalculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Recreate the view with correct references
CREATE OR REPLACE VIEW public.per_diem_summary AS
SELECT 
  p.id AS project_id,
  p.name AS project_name,
  p.job_number AS project_number,
  p.per_diem_enabled,
  p.per_diem_rate_direct,
  p.per_diem_rate_indirect,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS days_with_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Direct' THEN pdc.amount ELSE 0 END) AS total_direct_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Indirect' THEN pdc.amount ELSE 0 END) AS total_indirect_per_diem,
  SUM(pdc.amount) AS total_per_diem_amount,
  MAX(pdc.work_date) AS last_per_diem_date,
  MIN(pdc.work_date) AS first_per_diem_date
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.id, p.name, p.job_number, p.per_diem_enabled, 
         p.per_diem_rate_direct, p.per_diem_rate_indirect;

-- Step 8: Test with a simple query
SELECT COUNT(*) as projects_with_per_diem_enabled 
FROM projects 
WHERE per_diem_enabled = true;

-- Done!
SELECT 'Per diem complete fix applied successfully!' AS status;