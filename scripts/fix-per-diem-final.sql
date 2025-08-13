-- Final Fix for Per Diem to match actual database schema
-- The labor_employee_actuals table uses week_ending, not work_date

-- First, update the per_diem_costs table structure if needed
ALTER TABLE public.per_diem_costs 
  ALTER COLUMN work_date TYPE DATE USING work_date::date;

-- Drop and recreate the trigger function with correct column names
DROP TRIGGER IF EXISTS calculate_per_diem_on_labor_actual ON public.labor_employee_actuals;
DROP FUNCTION IF EXISTS calculate_per_diem_for_labor_actual();

-- Create simplified trigger function using correct column names
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

-- Recreate trigger
CREATE TRIGGER calculate_per_diem_on_labor_actual
  AFTER INSERT OR UPDATE ON public.labor_employee_actuals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_per_diem_for_labor_actual();

-- Update recalculation function with correct column names
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

-- Test the fix
SELECT 'Per diem final fix completed - using week_ending and 5-day work weeks' AS status;