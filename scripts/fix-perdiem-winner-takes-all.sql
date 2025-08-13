-- Per Diem Fix: Winner Takes All Allocation
-- This implements the one-per-diem-per-employee-per-day rule
-- When an employee works multiple projects, the project with most hours gets the per diem

-- ============================================
-- STEP 1: Update Project Settings
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 1: Updating Project Settings';
  RAISE NOTICE '========================================';
END $$;

UPDATE public.projects 
SET 
  per_diem_enabled = (job_number IN ('5867', '5639', '5640', '5614', '5601', '5800', '5730', '5772')),
  per_diem_rate_direct = 120.00,
  per_diem_rate_indirect = 120.00
WHERE 1=1;  -- Update all projects

-- Show which projects have per diem enabled
SELECT 
  job_number,
  name,
  per_diem_enabled,
  per_diem_rate_direct,
  per_diem_rate_indirect
FROM public.projects
WHERE per_diem_enabled = true
ORDER BY job_number;

-- ============================================
-- STEP 2: Clear Existing Incorrect Data
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 2: Clearing Existing Per Diem Data';
  RAISE NOTICE '========================================';
END $$;

TRUNCATE TABLE public.per_diem_costs;

-- ============================================
-- STEP 3: Create Smart Recalculation Function
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 3: Creating Smart Recalculation Function';
  RAISE NOTICE '========================================';
END $$;

CREATE OR REPLACE FUNCTION recalculate_per_diem_winner_takes_all()
RETURNS JSON AS $$
DECLARE
  v_records_processed INTEGER := 0;
  v_total_amount DECIMAL(10,2) := 0;
  v_employees_paid INTEGER := 0;
  v_days_covered INTEGER := 0;
  per_diem_record RECORD;
BEGIN
  -- Clear existing per diem data
  TRUNCATE TABLE public.per_diem_costs;
  
  -- Get list of projects with per diem enabled
  CREATE TEMP TABLE IF NOT EXISTS temp_perdiem_projects AS
  SELECT id, job_number 
  FROM public.projects 
  WHERE per_diem_enabled = true;
  
  -- Process each unique employee-day combination
  -- Winner takes all: project with most hours gets the per diem
  FOR per_diem_record IN
    WITH employee_daily_winner AS (
      -- Find the winning project for each employee-day
      SELECT DISTINCT ON (lea.employee_id, lea.work_date)
        lea.employee_id,
        lea.work_date,
        lea.project_id,
        SUM(lea.actual_hours) OVER (PARTITION BY lea.employee_id, lea.work_date, lea.project_id) as project_hours,
        lea.pay_period_ending,
        e.employee_type,
        p.job_number
      FROM public.labor_employee_actuals lea
      INNER JOIN temp_perdiem_projects tpp ON tpp.id = lea.project_id
      INNER JOIN public.employees e ON e.id = lea.employee_id
      INNER JOIN public.projects p ON p.id = lea.project_id
      WHERE lea.actual_hours > 0
      ORDER BY 
        lea.employee_id, 
        lea.work_date, 
        project_hours DESC,  -- Most hours wins
        p.job_number ASC     -- Tiebreaker: lower job number wins
    )
    SELECT 
      employee_id,
      work_date,
      project_id,
      employee_type,
      pay_period_ending,
      job_number,
      project_hours
    FROM employee_daily_winner
  LOOP
    -- Insert the per diem record (only one per employee per day)
    INSERT INTO public.per_diem_costs (
      project_id,
      employee_id,
      work_date,
      employee_type,
      rate_applied,
      days_worked,
      amount,
      pay_period_ending
    ) VALUES (
      per_diem_record.project_id,
      per_diem_record.employee_id,
      per_diem_record.work_date,
      per_diem_record.employee_type,
      120.00,  -- Flat rate for everyone
      1.00,
      120.00,  -- Flat amount for everyone
      per_diem_record.pay_period_ending
    );
    
    v_records_processed := v_records_processed + 1;
    v_total_amount := v_total_amount + 120.00;
  END LOOP;
  
  -- Get summary statistics
  SELECT 
    COUNT(DISTINCT employee_id),
    COUNT(DISTINCT work_date)
  INTO v_employees_paid, v_days_covered
  FROM public.per_diem_costs;
  
  -- Clean up temp table
  DROP TABLE IF EXISTS temp_perdiem_projects;
  
  RETURN json_build_object(
    'records_processed', v_records_processed,
    'total_amount', v_total_amount,
    'unique_employees', v_employees_paid,
    'unique_days', v_days_covered,
    'average_per_day', CASE WHEN v_days_covered > 0 THEN v_total_amount / v_days_covered ELSE 0 END,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Run the Recalculation
-- ============================================
DO $$
DECLARE
  result JSON;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 4: Running Per Diem Recalculation';
  RAISE NOTICE '========================================';
  
  SELECT recalculate_per_diem_winner_takes_all() INTO result;
  
  RAISE NOTICE 'Results:';
  RAISE NOTICE '  Records processed: %', result->>'records_processed';
  RAISE NOTICE '  Total amount: $%', result->>'total_amount';
  RAISE NOTICE '  Unique employees: %', result->>'unique_employees';
  RAISE NOTICE '  Unique days: %', result->>'unique_days';
  RAISE NOTICE '  Average per day: $%', result->>'average_per_day';
END $$;

-- ============================================
-- STEP 5: Show Summary by Project
-- ============================================
SELECT 
  p.job_number,
  p.name AS project_name,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS unique_days,
  COUNT(*) AS perdiem_records,
  SUM(pdc.amount) AS total_per_diem,
  TO_CHAR(SUM(pdc.amount), '$999,999.99') AS total_formatted
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.job_number, p.name
ORDER BY p.job_number;

-- ============================================
-- STEP 6: Verification Queries
-- ============================================

-- Check 1: Verify no employee has multiple per diems on the same day
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS: No employee has multiple per diems on the same day'
    ELSE '❌ FAIL: Found ' || COUNT(*) || ' cases of multiple per diems per day'
  END AS verification_1
FROM (
  SELECT employee_id, work_date, COUNT(*) as count
  FROM public.per_diem_costs
  GROUP BY employee_id, work_date
  HAVING COUNT(*) > 1
) duplicates;

-- Check 2: Verify all per diem amounts are exactly $120
SELECT 
  CASE 
    WHEN COUNT(DISTINCT amount) = 1 AND MAX(amount) = 120 THEN '✅ PASS: All per diem amounts are $120'
    ELSE '❌ FAIL: Found varying per diem amounts'
  END AS verification_2
FROM public.per_diem_costs
WHERE amount IS NOT NULL;

-- Check 3: Show sample of employees who worked multiple projects on the same day
WITH multi_project_days AS (
  SELECT 
    lea.employee_id,
    lea.work_date,
    COUNT(DISTINCT lea.project_id) as projects_worked,
    STRING_AGG(DISTINCT p.job_number, ', ' ORDER BY p.job_number) as project_numbers,
    MAX(CASE WHEN pdc.id IS NOT NULL THEN p.job_number END) as perdiem_assigned_to
  FROM public.labor_employee_actuals lea
  INNER JOIN public.projects p ON p.id = lea.project_id
  LEFT JOIN public.per_diem_costs pdc ON 
    pdc.employee_id = lea.employee_id 
    AND pdc.work_date = lea.work_date 
    AND pdc.project_id = lea.project_id
  WHERE lea.actual_hours > 0
    AND p.per_diem_enabled = true
  GROUP BY lea.employee_id, lea.work_date
  HAVING COUNT(DISTINCT lea.project_id) > 1
)
SELECT 
  '📊 Sample: Employees working multiple projects' as description,
  employee_id,
  work_date,
  projects_worked,
  project_numbers as worked_on_projects,
  perdiem_assigned_to as per_diem_given_to
FROM multi_project_days
ORDER BY work_date DESC, employee_id
LIMIT 10;

-- Check 4: Grand total verification
SELECT 
  '💰 Grand Total Per Diem' as description,
  COUNT(*) as total_records,
  COUNT(DISTINCT employee_id || '-' || work_date) as unique_employee_days,
  TO_CHAR(SUM(amount), '$999,999,999.99') as total_amount,
  TO_CHAR(COUNT(*) * 120, '$999,999,999.99') as expected_amount,
  CASE 
    WHEN SUM(amount) = COUNT(*) * 120 THEN '✅ Amounts match'
    ELSE '❌ Amount mismatch!'
  END as verification
FROM public.per_diem_costs;