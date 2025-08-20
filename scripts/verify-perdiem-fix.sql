-- Verification Queries for Per Diem Fix
-- Run these after applying the fix to verify the amounts are correct

-- 1. Summary by Project with Reasonableness Check
SELECT 
  p.job_number,
  p.name AS project_name,
  p.per_diem_rate_direct AS direct_rate,
  p.per_diem_rate_indirect AS indirect_rate,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS unique_days,
  COUNT(*) AS total_records,
  SUM(pdc.amount) AS total_per_diem,
  -- Reasonableness checks
  ROUND(SUM(pdc.amount)::NUMERIC / NULLIF(COUNT(*), 0), 2) AS avg_per_record,
  CASE 
    WHEN COUNT(*) > COUNT(DISTINCT pdc.employee_id || '-' || pdc.work_date) THEN 'DUPLICATES FOUND!'
    ELSE 'OK - No duplicates'
  END AS duplicate_check,
  -- Expected max (all employees every day at highest rate)
  COUNT(DISTINCT pdc.employee_id) * COUNT(DISTINCT pdc.work_date) * 
    GREATEST(p.per_diem_rate_direct, p.per_diem_rate_indirect) AS theoretical_max,
  -- Percentage of theoretical max
  ROUND((SUM(pdc.amount) / NULLIF(
    COUNT(DISTINCT pdc.employee_id) * COUNT(DISTINCT pdc.work_date) * 
    GREATEST(p.per_diem_rate_direct, p.per_diem_rate_indirect), 0
  ) * 100)::NUMERIC, 1) AS pct_of_max
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.id, p.job_number, p.name, p.per_diem_rate_direct, p.per_diem_rate_indirect
ORDER BY p.job_number;

-- 2. Daily Breakdown for Spot Checking (limited to first 20 records)
SELECT 
  p.job_number,
  pdc.work_date,
  pdc.employee_type,
  COUNT(DISTINCT pdc.employee_id) AS employees_that_day,
  SUM(pdc.amount) AS total_that_day,
  ARRAY_AGG(DISTINCT pdc.rate_applied) AS rates_applied
FROM public.per_diem_costs pdc
JOIN public.projects p ON p.id = pdc.project_id
WHERE p.job_number = '5640'  -- Check the largest project
GROUP BY p.job_number, pdc.work_date, pdc.employee_type
ORDER BY pdc.work_date DESC
LIMIT 20;

-- 3. Check for Any Remaining Duplicates
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No duplicates found - data is clean!'
    ELSE '❌ WARNING: ' || COUNT(*) || ' duplicate records found!'
  END AS status
FROM (
  SELECT project_id, employee_id, work_date
  FROM public.per_diem_costs
  GROUP BY project_id, employee_id, work_date
  HAVING COUNT(*) > 1
) dup;

-- 4. Compare Before and After (if you noted the previous amounts)
WITH current_totals AS (
  SELECT 
    p.job_number,
    SUM(pdc.amount) AS current_total
  FROM public.projects p
  LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
  WHERE p.per_diem_enabled = true
  GROUP BY p.job_number
)
SELECT 
  job_number,
  TO_CHAR(current_total, '$999,999,999.99') AS current_amount,
  CASE job_number
    WHEN '5640' THEN TO_CHAR(1172250.00, '$999,999,999.99')
    WHEN '5730' THEN TO_CHAR(221875.00, '$999,999,999.99')
    WHEN '5790' THEN TO_CHAR(62625.00, '$999,999,999.99')
    ELSE 'N/A'
  END AS previous_amount,
  CASE job_number
    WHEN '5640' THEN ROUND(((current_total / 1172250.00) * 100)::NUMERIC, 1) || '%'
    WHEN '5730' THEN ROUND(((current_total / 221875.00) * 100)::NUMERIC, 1) || '%'
    WHEN '5790' THEN ROUND(((current_total / 62625.00) * 100)::NUMERIC, 1) || '%'
    ELSE 'N/A'
  END AS pct_of_previous
FROM current_totals
ORDER BY job_number;

-- 5. Labor Actuals vs Per Diem Records Comparison
SELECT 
  p.job_number,
  p.name AS project_name,
  labor_counts.unique_employee_days AS labor_employee_days,
  perdiem_counts.perdiem_records AS perdiem_records,
  CASE 
    WHEN labor_counts.unique_employee_days = perdiem_counts.perdiem_records THEN '✅ Match'
    WHEN labor_counts.unique_employee_days > perdiem_counts.perdiem_records THEN '⚠️  Some missing per diem'
    ELSE '❌ Too many per diem records'
  END AS status
FROM public.projects p
LEFT JOIN (
  SELECT 
    project_id,
    COUNT(DISTINCT employee_id || '-' || work_date) AS unique_employee_days
  FROM public.labor_employee_actuals
  WHERE actual_hours > 0
  GROUP BY project_id
) labor_counts ON p.id = labor_counts.project_id
LEFT JOIN (
  SELECT 
    project_id,
    COUNT(*) AS perdiem_records
  FROM public.per_diem_costs
  GROUP BY project_id
) perdiem_counts ON p.id = perdiem_counts.project_id
WHERE p.per_diem_enabled = true
ORDER BY p.job_number;