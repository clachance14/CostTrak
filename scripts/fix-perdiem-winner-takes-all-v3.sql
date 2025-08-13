-- Per Diem Fix V3: Winner Takes All Allocation
-- Fixed column names: uses 'category' instead of 'employee_type'
-- This implements the one-per-diem-per-employee-per-day rule

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
-- STEP 3: Create Simple Weekly Calculation Function
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 3: Creating Per Diem Calculation Function';
  RAISE NOTICE '========================================';
END $$;

CREATE OR REPLACE FUNCTION recalculate_per_diem_simple_weekly()
RETURNS JSON AS $$
DECLARE
  v_records_processed INTEGER := 0;
  v_total_amount DECIMAL(10,2) := 0;
  per_diem_record RECORD;
BEGIN
  -- Clear existing per diem data
  TRUNCATE TABLE public.per_diem_costs;
  
  -- Process each employee-week combination
  -- Winner takes all: project with most hours gets 5 days of per diem
  FOR per_diem_record IN
    WITH employee_weekly_hours AS (
      -- Calculate total hours per employee per week per project
      SELECT 
        lea.employee_id,
        lea.week_ending,
        lea.project_id,
        COALESCE(e.category, 'Direct') as employee_category,  -- Default to Direct if null
        lea.pay_period_ending,
        p.job_number,
        SUM(lea.actual_hours) as total_hours
      FROM public.labor_employee_actuals lea
      INNER JOIN public.employees e ON e.id = lea.employee_id
      INNER JOIN public.projects p ON p.id = lea.project_id
      WHERE lea.actual_hours > 0
        AND p.per_diem_enabled = true
      GROUP BY lea.employee_id, lea.week_ending, lea.project_id, 
               e.category, lea.pay_period_ending, p.job_number
    ),
    employee_weekly_winner AS (
      -- Find the project with most hours for each employee-week
      SELECT DISTINCT ON (employee_id, week_ending)
        employee_id,
        week_ending,
        project_id,
        employee_category,
        pay_period_ending,
        job_number,
        total_hours
      FROM employee_weekly_hours
      ORDER BY employee_id, week_ending, total_hours DESC, job_number ASC
    )
    SELECT * FROM employee_weekly_winner
  LOOP
    -- Insert 5 per diem records (Monday through Friday)
    FOR i IN 0..4 LOOP
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
        -- Calculate the work date (Monday = week_ending - 4 days, Tuesday = -3, etc.)
        per_diem_record.week_ending - INTERVAL '1 day' * (4 - i),
        per_diem_record.employee_category,  -- Map category to employee_type
        120.00,
        1.00,
        120.00,
        per_diem_record.pay_period_ending
      )
      ON CONFLICT (project_id, employee_id, work_date) 
      DO NOTHING;
      
      v_records_processed := v_records_processed + 1;
      v_total_amount := v_total_amount + 120.00;
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'records_processed', v_records_processed,
    'total_amount', v_total_amount,
    'message', 'Simple weekly calculation: 5 days per week for winning project',
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
  
  SELECT recalculate_per_diem_simple_weekly() INTO result;
  
  RAISE NOTICE 'Results:';
  RAISE NOTICE '  Records processed: %', result->>'records_processed';
  RAISE NOTICE '  Total amount: $%', result->>'total_amount';
  RAISE NOTICE '  Message: %', result->>'message';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Per Diem Calculation Complete!';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 5: Show Summary by Project
-- ============================================
RAISE NOTICE '';
RAISE NOTICE 'Per Diem Summary by Project:';
RAISE NOTICE '========================================';

SELECT 
  p.job_number,
  LEFT(p.name, 40) AS project_name,
  COUNT(DISTINCT pdc.employee_id) AS employees,
  COUNT(DISTINCT DATE_TRUNC('week', pdc.work_date)) AS weeks,
  COUNT(*) AS records,
  TO_CHAR(SUM(pdc.amount), '$999,999') AS total
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.job_number, p.name
ORDER BY p.job_number;

-- ============================================
-- STEP 6: Verification Queries
-- ============================================
RAISE NOTICE '';
RAISE NOTICE 'Verification Results:';
RAISE NOTICE '========================================';

-- Check 1: Verify no employee has multiple per diems on the same day
WITH dup_check AS (
  SELECT COUNT(*) as dup_count
  FROM (
    SELECT employee_id, work_date, COUNT(*) as count
    FROM public.per_diem_costs
    GROUP BY employee_id, work_date
    HAVING COUNT(*) > 1
  ) duplicates
)
SELECT 
  CASE 
    WHEN dup_count = 0 THEN '✅ PASS: No duplicate per diems per employee per day'
    ELSE '❌ FAIL: Found ' || dup_count || ' duplicate per diems'
  END AS verification_1
FROM dup_check;

-- Check 2: Verify all per diem amounts are exactly $120
WITH amount_check AS (
  SELECT COUNT(DISTINCT amount) as distinct_amounts, MAX(amount) as max_amount
  FROM public.per_diem_costs
  WHERE amount IS NOT NULL
)
SELECT 
  CASE 
    WHEN distinct_amounts = 1 AND max_amount = 120 THEN '✅ PASS: All per diem amounts are $120'
    ELSE '❌ FAIL: Found varying per diem amounts'
  END AS verification_2
FROM amount_check;

-- Check 3: Weekly breakdown sample
RAISE NOTICE '';
RAISE NOTICE 'Sample Weekly Breakdown (latest 5 weeks):';

SELECT 
  TO_CHAR(DATE_TRUNC('week', work_date), 'YYYY-MM-DD') as week_start,
  COUNT(DISTINCT employee_id) as employees,
  COUNT(*) as records,
  COUNT(*) / NULLIF(COUNT(DISTINCT employee_id), 0) as days_per_emp,
  TO_CHAR(SUM(amount), '$999,999') as total
FROM public.per_diem_costs
GROUP BY DATE_TRUNC('week', work_date)
ORDER BY week_start DESC
LIMIT 5;

-- Check 4: Grand total
RAISE NOTICE '';
RAISE NOTICE 'Grand Total Summary:';

SELECT 
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(DISTINCT work_date) as unique_days,
  COUNT(*) as total_records,
  TO_CHAR(SUM(amount), '$999,999,999') as total_amount,
  TO_CHAR(COUNT(*) * 120, '$999,999,999') as expected_amount,
  CASE 
    WHEN SUM(amount) = COUNT(*) * 120 THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as verification
FROM public.per_diem_costs;

-- ============================================
-- STEP 7: Sample of Multi-Project Employees
-- ============================================
RAISE NOTICE '';
RAISE NOTICE 'Employees Working Multiple Projects (Sample):';

WITH multi_project AS (
  SELECT 
    lea.employee_id,
    e.name as emp_name,
    lea.week_ending,
    COUNT(DISTINCT lea.project_id) as projects_count,
    STRING_AGG(DISTINCT p.job_number, ', ' ORDER BY p.job_number) as projects,
    MAX(CASE WHEN pdc.id IS NOT NULL THEN p.job_number END) as got_perdiem
  FROM public.labor_employee_actuals lea
  INNER JOIN public.employees e ON e.id = lea.employee_id
  INNER JOIN public.projects p ON p.id = lea.project_id
  LEFT JOIN public.per_diem_costs pdc ON 
    pdc.employee_id = lea.employee_id 
    AND DATE_TRUNC('week', pdc.work_date) = DATE_TRUNC('week', lea.week_ending - INTERVAL '2 days')
    AND pdc.project_id = lea.project_id
  WHERE lea.actual_hours > 0
    AND p.per_diem_enabled = true
  GROUP BY lea.employee_id, e.name, lea.week_ending
  HAVING COUNT(DISTINCT lea.project_id) > 1
)
SELECT 
  LEFT(emp_name, 20) as employee,
  TO_CHAR(week_ending, 'MM/DD') as week,
  projects_count as proj_cnt,
  projects as worked_on,
  got_perdiem as perdiem_to
FROM multi_project
ORDER BY week_ending DESC, emp_name
LIMIT 10;