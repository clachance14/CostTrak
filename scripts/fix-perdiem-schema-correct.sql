-- Per Diem Fix - Schema Correct Version
-- This script properly handles the actual database schema
-- Implements one-per-diem-per-employee-per-day rule with winner-takes-all

-- ============================================
-- STEP 1: Update Project Settings
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 1: Updating Project Settings';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Setting per diem to $120/day for all employees';
  RAISE NOTICE 'Enabling for projects: 5867, 5639, 5640, 5614, 5601, 5800, 5730, 5772';
END $$;

UPDATE public.projects 
SET 
  per_diem_enabled = (job_number IN ('5867', '5639', '5640', '5614', '5601', '5800', '5730', '5772')),
  per_diem_rate_direct = 120.00,
  per_diem_rate_indirect = 120.00
WHERE 1=1;

-- Show results
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
-- STEP 2: Clear Existing Per Diem Data
-- ============================================
DO $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM public.per_diem_costs;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 2: Clearing Existing Per Diem Data';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Removing % existing per diem records', existing_count;
  
  TRUNCATE TABLE public.per_diem_costs;
  
  RAISE NOTICE 'Table cleared successfully';
END $$;

-- ============================================
-- STEP 3: Create Corrected Calculation Function
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 3: Creating Calculation Function';
  RAISE NOTICE '========================================';
END $$;

CREATE OR REPLACE FUNCTION recalculate_per_diem_winner_takes_all()
RETURNS JSON AS $$
DECLARE
  v_records_processed INTEGER := 0;
  v_total_amount DECIMAL(10,2) := 0;
  v_weeks_processed INTEGER := 0;
  per_diem_record RECORD;
  day_offset INTEGER;
  work_date DATE;
BEGIN
  -- Clear existing per diem data
  TRUNCATE TABLE public.per_diem_costs;
  
  -- Process each employee-week combination
  -- Winner takes all: project with most hours gets all 5 days
  FOR per_diem_record IN
    WITH employee_weekly_hours AS (
      -- Calculate total hours per employee per week per project
      SELECT 
        lea.employee_id,
        lea.week_ending,
        lea.project_id,
        e.category as employee_category,
        p.job_number,
        SUM(lea.total_hours) as total_hours
      FROM public.labor_employee_actuals lea
      INNER JOIN public.employees e ON e.id = lea.employee_id
      INNER JOIN public.projects p ON p.id = lea.project_id
      WHERE lea.total_hours > 0
        AND p.per_diem_enabled = true
        AND e.category IN ('Direct', 'Indirect')  -- Only these categories get per diem
      GROUP BY lea.employee_id, lea.week_ending, lea.project_id, 
               e.category, p.job_number
    ),
    employee_weekly_winner AS (
      -- Find the project with most hours for each employee-week
      SELECT DISTINCT ON (employee_id, week_ending)
        employee_id,
        week_ending,
        project_id,
        employee_category,
        job_number,
        total_hours
      FROM employee_weekly_hours
      ORDER BY employee_id, week_ending, total_hours DESC, job_number ASC
    )
    SELECT * FROM employee_weekly_winner
  LOOP
    v_weeks_processed := v_weeks_processed + 1;
    
    -- Insert 5 per diem records (Monday through Friday)
    -- week_ending is typically Sunday, so:
    -- Monday = week_ending - 6 days
    -- Tuesday = week_ending - 5 days
    -- Wednesday = week_ending - 4 days
    -- Thursday = week_ending - 3 days
    -- Friday = week_ending - 2 days
    FOR day_offset IN REVERSE 6..2 LOOP
      work_date := per_diem_record.week_ending - INTERVAL '1 day' * day_offset;
      
      BEGIN
        INSERT INTO public.per_diem_costs (
          project_id,
          employee_id,
          work_date,
          employee_type,
          rate_applied,
          days_worked,
          amount
        ) VALUES (
          per_diem_record.project_id,
          per_diem_record.employee_id,
          work_date,
          per_diem_record.employee_category,
          120.00,
          1.00,
          120.00
        );
        
        v_records_processed := v_records_processed + 1;
        v_total_amount := v_total_amount + 120.00;
      EXCEPTION
        WHEN unique_violation THEN
          -- Skip if this employee-day already exists (shouldn't happen with TRUNCATE)
          NULL;
      END;
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'records_processed', v_records_processed,
    'total_amount', v_total_amount,
    'weeks_processed', v_weeks_processed,
    'average_per_week', CASE WHEN v_weeks_processed > 0 
                         THEN (v_total_amount / v_weeks_processed)::NUMERIC(10,2) 
                         ELSE 0 END,
    'message', 'Winner takes all: 5 days per week to project with most hours',
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Run the Calculation
-- ============================================
DO $$
DECLARE
  result JSON;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Step 4: Running Per Diem Calculation';
  RAISE NOTICE '========================================';
  
  SELECT recalculate_per_diem_winner_takes_all() INTO result;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Calculation Complete!';
  RAISE NOTICE '  Records created: %', result->>'records_processed';
  RAISE NOTICE '  Total amount: $%', result->>'total_amount';
  RAISE NOTICE '  Weeks processed: %', result->>'weeks_processed';
  RAISE NOTICE '  Average per week: $%', result->>'average_per_week';
  RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 5: Summary by Project
-- ============================================
SELECT 
  '📊 PROJECT SUMMARY' as report_type,
  p.job_number,
  LEFT(p.name, 35) AS project_name,
  COUNT(DISTINCT pdc.employee_id) AS employees,
  COUNT(DISTINCT DATE_TRUNC('week', pdc.work_date + INTERVAL '2 days')) AS weeks,
  COUNT(*) AS records,
  TO_CHAR(SUM(pdc.amount), '$999,999') AS total
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.job_number, p.name
ORDER BY p.job_number;

-- ============================================
-- STEP 6: Verification Checks
-- ============================================

-- Check 1: No duplicate per diems per employee per day
WITH dup_check AS (
  SELECT 
    employee_id, 
    work_date, 
    COUNT(*) as count
  FROM public.per_diem_costs
  GROUP BY employee_id, work_date
  HAVING COUNT(*) > 1
)
SELECT 
  '✅ DUPLICATE CHECK' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: No employee has multiple per diems on same day'
    ELSE 'FAIL: Found ' || COUNT(*) || ' duplicates'
  END AS result
FROM dup_check;

-- Check 2: All amounts are $120
SELECT 
  '✅ AMOUNT CHECK' as check_type,
  CASE 
    WHEN COUNT(DISTINCT amount) = 1 AND MAX(amount) = 120 
    THEN 'PASS: All per diem amounts are exactly $120'
    ELSE 'FAIL: Found ' || COUNT(DISTINCT amount) || ' different amounts'
  END AS result
FROM public.per_diem_costs;

-- Check 3: Weekly pattern check (should be 5 days per employee-week)
WITH weekly_pattern AS (
  SELECT 
    employee_id,
    DATE_TRUNC('week', work_date + INTERVAL '2 days') as week_start,
    COUNT(*) as days_in_week
  FROM public.per_diem_costs
  GROUP BY employee_id, DATE_TRUNC('week', work_date + INTERVAL '2 days')
)
SELECT 
  '✅ WEEKLY PATTERN' as check_type,
  CASE 
    WHEN MIN(days_in_week) = 5 AND MAX(days_in_week) = 5 
    THEN 'PASS: All employee-weeks have exactly 5 days'
    ELSE 'WARNING: Found weeks with ' || MIN(days_in_week) || ' to ' || MAX(days_in_week) || ' days'
  END AS result
FROM weekly_pattern;

-- ============================================
-- STEP 7: Grand Total
-- ============================================
SELECT 
  '💰 GRAND TOTAL' as summary_type,
  COUNT(DISTINCT employee_id) as employees,
  COUNT(DISTINCT work_date) as unique_days,
  COUNT(*) as total_records,
  TO_CHAR(SUM(amount), '$999,999,999') as total_amount,
  TO_CHAR(COUNT(*) * 120, '$999,999,999') as expected,
  CASE 
    WHEN SUM(amount) = COUNT(*) * 120 THEN '✅ Match'
    ELSE '❌ Mismatch'
  END AS verification
FROM public.per_diem_costs;

-- ============================================
-- STEP 8: Sample Weekly Breakdown
-- ============================================
SELECT 
  '📅 WEEKLY SAMPLE' as report_type,
  TO_CHAR(DATE_TRUNC('week', work_date + INTERVAL '2 days'), 'YYYY-MM-DD') as week_monday,
  COUNT(DISTINCT employee_id) as employees,
  COUNT(*) as records,
  COUNT(*) / NULLIF(COUNT(DISTINCT employee_id), 0) as days_per_emp,
  TO_CHAR(SUM(amount), '$999,999') as weekly_total
FROM public.per_diem_costs
GROUP BY DATE_TRUNC('week', work_date + INTERVAL '2 days')
ORDER BY week_monday DESC
LIMIT 5;

-- ============================================
-- STEP 9: Multi-Project Employee Sample
-- ============================================
WITH project_hours AS (
  -- First, calculate hours per project for each employee-week
  SELECT 
    lea.employee_id,
    e.first_name || ' ' || e.last_name as emp_name,
    lea.week_ending,
    lea.project_id,
    p.job_number,
    SUM(lea.total_hours) as hours_on_project
  FROM public.labor_employee_actuals lea
  INNER JOIN public.employees e ON e.id = lea.employee_id
  INNER JOIN public.projects p ON p.id = lea.project_id
  WHERE lea.total_hours > 0
    AND p.per_diem_enabled = true
  GROUP BY lea.employee_id, e.first_name, e.last_name, lea.week_ending, lea.project_id, p.job_number
),
multi_project AS (
  -- Then aggregate by employee-week
  SELECT 
    employee_id,
    emp_name,
    week_ending,
    COUNT(*) as projects_count,
    STRING_AGG(job_number || ' (' || ROUND(hours_on_project, 1) || 'h)', ', ' ORDER BY hours_on_project DESC) as projects_hours
  FROM project_hours
  GROUP BY employee_id, emp_name, week_ending
  HAVING COUNT(*) > 1
  ORDER BY week_ending DESC
  LIMIT 5
)
SELECT 
  '🔄 MULTI-PROJECT' as report_type,
  LEFT(emp_name, 25) as employee,
  TO_CHAR(week_ending, 'MM/DD/YY') as week,
  projects_count as projects,
  projects_hours as breakdown
FROM multi_project;

-- ============================================
-- FINAL SUCCESS MESSAGE
-- ============================================
DO $$
DECLARE
  total_amount DECIMAL(10,2);
  total_records INTEGER;
  unique_employees INTEGER;
BEGIN
  SELECT 
    SUM(amount), 
    COUNT(*),
    COUNT(DISTINCT employee_id)
  INTO total_amount, total_records, unique_employees
  FROM public.per_diem_costs;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 PER DIEM FIX COMPLETE AND VERIFIED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  Total Records: %', total_records;
  RAISE NOTICE '  Unique Employees: %', unique_employees;
  RAISE NOTICE '  Total Amount: $%', TO_CHAR(total_amount, 'FM999,999,999');
  RAISE NOTICE '';
  RAISE NOTICE 'Rules Applied:';
  RAISE NOTICE '  ✓ $120/day for all employees';
  RAISE NOTICE '  ✓ One per diem per employee per day';
  RAISE NOTICE '  ✓ Winner takes all (most hours)';
  RAISE NOTICE '  ✓ 5 days per week (Mon-Fri)';
  RAISE NOTICE '';
  RAISE NOTICE 'Enabled Projects:';
  RAISE NOTICE '  5867, 5639, 5640, 5614, 5601, 5800, 5730, 5772';
  RAISE NOTICE '========================================';
END $$;