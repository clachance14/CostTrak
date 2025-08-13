-- Fix Per Diem Migration to use correct employee category field
-- Run this in Supabase SQL Editor to update the trigger function

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS calculate_per_diem_on_labor_actual ON public.labor_employee_actuals;

-- Update the function to use 'category' instead of 'employee_type'
CREATE OR REPLACE FUNCTION calculate_per_diem_for_labor_actual()
RETURNS TRIGGER AS $$
DECLARE
  v_project_per_diem_enabled BOOLEAN;
  v_per_diem_rate_direct DECIMAL(10,2);
  v_per_diem_rate_indirect DECIMAL(10,2);
  v_employee_category VARCHAR(20);
  v_rate_to_apply DECIMAL(10,2);
  v_days_worked DECIMAL(5,2);
BEGIN
  -- Check if per diem is enabled for this project
  SELECT per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect
  INTO v_project_per_diem_enabled, v_per_diem_rate_direct, v_per_diem_rate_indirect
  FROM public.projects
  WHERE id = NEW.project_id;
  
  -- Exit if per diem is not enabled or rates are zero
  IF NOT v_project_per_diem_enabled OR 
     (v_per_diem_rate_direct = 0 AND v_per_diem_rate_indirect = 0) THEN
    RETURN NEW;
  END IF;
  
  -- Get employee category (Direct, Indirect, or Staff)
  SELECT category
  INTO v_employee_category
  FROM public.employees
  WHERE id = NEW.employee_id;
  
  -- Determine which rate to apply
  -- Note: Staff employees are treated as Indirect for per diem purposes
  IF v_employee_category = 'Direct' THEN
    v_rate_to_apply := v_per_diem_rate_direct;
  ELSE -- Indirect or Staff
    v_rate_to_apply := v_per_diem_rate_indirect;
  END IF;
  
  -- Skip if rate is zero
  IF v_rate_to_apply = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Calculate days worked (assuming actual_hours > 0 means a day worked)
  IF NEW.actual_hours > 0 THEN
    v_days_worked := 1.00;  -- Simplified: any hours worked = 1 day per diem
  ELSE
    v_days_worked := 0;
  END IF;
  
  -- Skip if no days worked
  IF v_days_worked = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Insert or update per diem cost record
  -- Map category to employee_type for storage (Staff -> Indirect)
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
    NEW.work_date,
    CASE 
      WHEN v_employee_category = 'Direct' THEN 'Direct'
      ELSE 'Indirect'  -- Both Indirect and Staff map to Indirect for per diem
    END,
    v_rate_to_apply,
    v_days_worked,
    v_rate_to_apply * v_days_worked,
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

-- Recreate the trigger
CREATE TRIGGER calculate_per_diem_on_labor_actual
  AFTER INSERT OR UPDATE ON public.labor_employee_actuals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_per_diem_for_labor_actual();

-- Also update the recalculation function
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

  -- Delete existing per diem costs for the project
  DELETE FROM public.per_diem_costs
  WHERE project_id = p_project_id;
  
  -- Insert per diem costs for all labor actuals with hours
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
    la.work_date,
    CASE 
      WHEN e.category = 'Direct' THEN 'Direct'
      ELSE 'Indirect'
    END AS employee_type,
    CASE 
      WHEN e.category = 'Direct' THEN v_per_diem_rate_direct
      ELSE v_per_diem_rate_indirect
    END AS rate_applied,
    1.00 AS days_worked,
    CASE 
      WHEN e.category = 'Direct' THEN v_per_diem_rate_direct
      ELSE v_per_diem_rate_indirect
    END AS amount,
    la.id AS labor_actual_id,
    la.pay_period_ending
  FROM public.labor_employee_actuals la
  JOIN public.employees e ON e.id = la.employee_id
  WHERE la.project_id = p_project_id
    AND la.actual_hours > 0
    AND (
      (e.category = 'Direct' AND v_per_diem_rate_direct > 0) OR
      (e.category IN ('Indirect', 'Staff') AND v_per_diem_rate_indirect > 0)
    );
  
  -- Get counts for return
  GET DIAGNOSTICS v_total_calculated = ROW_COUNT;
  
  -- Get total per diem amount
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

-- Verify the fix
SELECT 'Per diem migration fix completed' AS status;