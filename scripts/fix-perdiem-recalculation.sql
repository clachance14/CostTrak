-- Fix for Per Diem Recalculation Function
-- This corrects the bug that was creating multiple per diem entries per employee per day

-- 1. First, clear all existing per diem data (it's incorrect)
TRUNCATE TABLE public.per_diem_costs;

-- 2. Create the corrected recalculation function
CREATE OR REPLACE FUNCTION recalculate_project_per_diem(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  v_project_per_diem_enabled BOOLEAN;
  v_per_diem_rate_direct DECIMAL(10,2);
  v_per_diem_rate_indirect DECIMAL(10,2);
  v_records_processed INTEGER := 0;
  v_total_amount DECIMAL(10,2) := 0;
  labor_record RECORD;
BEGIN
  -- Get project per diem configuration
  SELECT per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect
  INTO v_project_per_diem_enabled, v_per_diem_rate_direct, v_per_diem_rate_indirect
  FROM public.projects
  WHERE id = p_project_id;
  
  -- Exit if per diem is not enabled
  IF NOT v_project_per_diem_enabled OR 
     (v_per_diem_rate_direct = 0 AND v_per_diem_rate_indirect = 0) THEN
    RETURN json_build_object(
      'project_id', p_project_id,
      'records_processed', 0,
      'total_per_diem_amount', 0,
      'message', 'Per diem not enabled or rates are zero'
    );
  END IF;
  
  -- Delete existing per diem costs for the project
  DELETE FROM public.per_diem_costs
  WHERE project_id = p_project_id;
  
  -- Process each unique employee/date combination
  FOR labor_record IN
    SELECT DISTINCT
      lea.project_id,
      lea.employee_id,
      lea.work_date,
      lea.pay_period_ending,
      e.employee_type,
      MAX(lea.id) AS labor_actual_id,  -- Use the latest record if multiple
      SUM(lea.actual_hours) AS total_hours  -- Sum hours if multiple entries
    FROM public.labor_employee_actuals lea
    JOIN public.employees e ON e.id = lea.employee_id
    WHERE lea.project_id = p_project_id
      AND lea.actual_hours > 0
    GROUP BY lea.project_id, lea.employee_id, lea.work_date, 
             lea.pay_period_ending, e.employee_type
  LOOP
    DECLARE
      v_rate_to_apply DECIMAL(10,2);
      v_amount DECIMAL(10,2);
    BEGIN
      -- Determine which rate to apply based on employee type
      IF labor_record.employee_type = 'Direct' THEN
        v_rate_to_apply := v_per_diem_rate_direct;
      ELSE
        v_rate_to_apply := v_per_diem_rate_indirect;
      END IF;
      
      -- Skip if rate is zero
      IF v_rate_to_apply = 0 THEN
        CONTINUE;
      END IF;
      
      -- Calculate per diem amount (1 day = 1 per diem regardless of hours)
      v_amount := v_rate_to_apply;
      
      -- Insert per diem cost record
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
        labor_record.project_id,
        labor_record.employee_id,
        labor_record.work_date,
        labor_record.employee_type,
        v_rate_to_apply,
        1.00,  -- Always 1 day per diem per day worked
        v_amount,
        labor_record.labor_actual_id,
        labor_record.pay_period_ending
      )
      ON CONFLICT (project_id, employee_id, work_date)
      DO UPDATE SET
        rate_applied = EXCLUDED.rate_applied,
        amount = EXCLUDED.amount,
        labor_actual_id = EXCLUDED.labor_actual_id,
        pay_period_ending = EXCLUDED.pay_period_ending,
        updated_at = NOW();
      
      v_records_processed := v_records_processed + 1;
      v_total_amount := v_total_amount + v_amount;
    END;
  END LOOP;
  
  RETURN json_build_object(
    'project_id', p_project_id,
    'records_processed', v_records_processed,
    'total_per_diem_amount', v_total_amount,
    'recalculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recalculate per diem for all enabled projects
DO $$
DECLARE
  project_record RECORD;
  result JSON;
  total_projects INTEGER := 0;
  total_amount DECIMAL(10,2) := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting Corrected Per Diem Calculation';
  RAISE NOTICE '========================================';
  
  FOR project_record IN 
    SELECT id, name, job_number
    FROM public.projects
    WHERE per_diem_enabled = true
    ORDER BY job_number
  LOOP
    SELECT recalculate_project_per_diem(project_record.id) INTO result;
    
    total_projects := total_projects + 1;
    total_amount := total_amount + COALESCE((result->>'total_per_diem_amount')::DECIMAL, 0);
    
    RAISE NOTICE 'Project % (%): % records, $% total', 
      project_record.name, 
      project_record.job_number,
      COALESCE((result->>'records_processed')::INTEGER, 0),
      COALESCE((result->>'total_per_diem_amount')::DECIMAL, 0);
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Corrected Per Diem Calculation Complete!';
  RAISE NOTICE '   Projects processed: %', total_projects;
  RAISE NOTICE '   Total per diem amount: $%', total_amount;
  RAISE NOTICE '========================================';
END $$;

-- 4. Show the corrected summary
SELECT 
  p.name AS project_name,
  p.job_number,
  p.per_diem_rate_direct,
  p.per_diem_rate_indirect,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS unique_days,
  COUNT(*) AS total_records,
  SUM(CASE WHEN pdc.employee_type = 'Direct' THEN pdc.amount ELSE 0 END) AS direct_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Indirect' THEN pdc.amount ELSE 0 END) AS indirect_per_diem,
  SUM(pdc.amount) AS total_per_diem,
  ROUND(SUM(pdc.amount) / NULLIF(COUNT(*), 0), 2) AS avg_per_record
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.id, p.name, p.job_number, p.per_diem_rate_direct, p.per_diem_rate_indirect
ORDER BY p.job_number;

-- 5. Verification query - check for any duplicates
SELECT 
  'Duplicate Check' AS check_type,
  COUNT(*) AS duplicate_count
FROM (
  SELECT project_id, employee_id, work_date, COUNT(*) AS cnt
  FROM public.per_diem_costs
  GROUP BY project_id, employee_id, work_date
  HAVING COUNT(*) > 1
) duplicates;