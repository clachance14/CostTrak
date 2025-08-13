-- Per Diem Fix V2: Winner Takes All Allocation
-- Fixed to work with week_ending instead of work_date
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
  v_weeks_covered INTEGER := 0;
  per_diem_record RECORD;
BEGIN
  -- Clear existing per diem data
  TRUNCATE TABLE public.per_diem_costs;
  
  -- Get list of projects with per diem enabled
  CREATE TEMP TABLE IF NOT EXISTS temp_perdiem_projects AS
  SELECT id, job_number 
  FROM public.projects 
  WHERE per_diem_enabled = true;
  
  -- Since we only have week_ending, we'll calculate per diem per week
  -- Assuming 5 days worked per week (Monday-Friday)
  -- If an employee works multiple projects in a week, the one with most hours gets the per diem
  FOR per_diem_record IN
    WITH employee_weekly_winner AS (
      -- Find the winning project for each employee-week
      SELECT DISTINCT ON (lea.employee_id, lea.week_ending)
        lea.employee_id,
        lea.week_ending,
        lea.project_id,
        SUM(lea.actual_hours) OVER (PARTITION BY lea.employee_id, lea.week_ending, lea.project_id) as project_hours,
        lea.pay_period_ending,
        e.employee_type,
        p.job_number,
        -- Calculate days worked (assuming 40 hour week = 5 days, proportional for less)
        LEAST(5, CEILING(SUM(lea.actual_hours) OVER (PARTITION BY lea.employee_id, lea.week_ending) / 8.0)) as days_in_week
      FROM public.labor_employee_actuals lea
      INNER JOIN temp_perdiem_projects tpp ON tpp.id = lea.project_id
      INNER JOIN public.employees e ON e.id = lea.employee_id
      INNER JOIN public.projects p ON p.id = lea.project_id
      WHERE lea.actual_hours > 0
      ORDER BY 
        lea.employee_id, 
        lea.week_ending, 
        project_hours DESC,  -- Most hours wins
        p.job_number ASC     -- Tiebreaker: lower job number wins
    )
    SELECT 
      employee_id,
      week_ending,
      project_id,
      employee_type,
      pay_period_ending,
      job_number,
      project_hours,
      days_in_week
    FROM employee_weekly_winner
  LOOP
    -- For each day in the week that was worked, create a per diem entry
    -- We'll use the week_ending date and work backwards
    FOR i IN 0..(per_diem_record.days_in_week - 1) LOOP
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
        per_diem_record.week_ending - INTERVAL '1 day' * i,  -- Work backwards from week ending
        per_diem_record.employee_type,
        120.00,  -- Flat rate for everyone
        1.00,
        120.00,  -- Flat amount for everyone
        per_diem_record.pay_period_ending
      )
      ON CONFLICT (project_id, employee_id, work_date) 
      DO NOTHING;  -- Skip if already exists (shouldn't happen with TRUNCATE)
      
      v_records_processed := v_records_processed + 1;
      v_total_amount := v_total_amount + 120.00;
    END LOOP;
  END LOOP;
  
  -- Get summary statistics
  SELECT 
    COUNT(DISTINCT employee_id),
    COUNT(DISTINCT DATE_TRUNC('week', work_date))
  INTO v_employees_paid, v_weeks_covered
  FROM public.per_diem_costs;
  
  -- Clean up temp table
  DROP TABLE IF EXISTS temp_perdiem_projects;
  
  RETURN json_build_object(
    'records_processed', v_records_processed,
    'total_amount', v_total_amount,
    'unique_employees', v_employees_paid,
    'weeks_covered', v_weeks_covered,
    'average_per_week', CASE WHEN v_weeks_covered > 0 THEN v_total_amount / v_weeks_covered ELSE 0 END,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ALTERNATIVE: Simple Weekly Approach
-- ============================================
-- If the above is too complex, here's a simpler approach:
-- Just give 5 days of per diem per week to the project with most hours

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
        e.employee_type,
        lea.pay_period_ending,
        p.job_number,
        SUM(lea.actual_hours) as total_hours
      FROM public.labor_employee_actuals lea
      INNER JOIN public.employees e ON e.id = lea.employee_id
      INNER JOIN public.projects p ON p.id = lea.project_id
      WHERE lea.actual_hours > 0
        AND p.per_diem_enabled = true
      GROUP BY lea.employee_id, lea.week_ending, lea.project_id, 
               e.employee_type, lea.pay_period_ending, p.job_number
    ),
    employee_weekly_winner AS (
      -- Find the project with most hours for each employee-week
      SELECT DISTINCT ON (employee_id, week_ending)
        employee_id,
        week_ending,
        project_id,
        employee_type,
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
        per_diem_record.employee_type,
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
-- STEP 4: Run the Recalculation (Simple Version)
-- ============================================
DO $$
DECLARE
  result JSON;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 4: Running Per Diem Recalculation';
  RAISE NOTICE '========================================';
  
  -- Use the simple weekly version
  SELECT recalculate_per_diem_simple_weekly() INTO result;
  
  RAISE NOTICE 'Results:';
  RAISE NOTICE '  Records processed: %', result->>'records_processed';
  RAISE NOTICE '  Total amount: $%', result->>'total_amount';
  RAISE NOTICE '  Message: %', result->>'message';
END $$;

-- ============================================
-- STEP 5: Show Summary by Project
-- ============================================
SELECT 
  p.job_number,
  p.name AS project_name,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS unique_days,
  COUNT(DISTINCT DATE_TRUNC('week', pdc.work_date)) AS weeks_covered,
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

-- Check 3: Weekly breakdown to verify 5 days per week allocation
SELECT 
  DATE_TRUNC('week', work_date) as week_start,
  COUNT(DISTINCT employee_id) as employees,
  COUNT(*) as total_records,
  COUNT(*) / NULLIF(COUNT(DISTINCT employee_id), 0) as days_per_employee,
  TO_CHAR(SUM(amount), '$999,999.99') as weekly_total
FROM public.per_diem_costs
GROUP BY DATE_TRUNC('week', work_date)
ORDER BY week_start DESC
LIMIT 10;

-- Check 4: Grand total verification
SELECT 
  '💰 Grand Total Per Diem' as description,
  COUNT(*) as total_records,
  COUNT(DISTINCT employee_id || '-' || work_date) as unique_employee_days,
  TO_CHAR(SUM(amount), '$999,999,999.99') as total_amount,
  CASE 
    WHEN SUM(amount) = COUNT(*) * 120 THEN '✅ Amounts match ($120 per record)'
    ELSE '❌ Amount mismatch!'
  END as verification
FROM public.per_diem_costs;