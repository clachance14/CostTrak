-- Check for Per Diem Conflicts
-- This shows employees working multiple per-diem-enabled projects on the same day

-- List of per diem enabled projects
WITH perdiem_projects AS (
  SELECT id, job_number, name 
  FROM public.projects 
  WHERE job_number IN ('5867', '5639', '5640', '5614', '5601', '5800', '5730', '5772')
),

-- Find all multi-project days
multi_project_days AS (
  SELECT 
    lea.employee_id,
    e.name as employee_name,
    lea.work_date,
    COUNT(DISTINCT lea.project_id) as projects_worked,
    SUM(lea.actual_hours) as total_hours,
    STRING_AGG(
      p.job_number || ' (' || ROUND(SUM(lea.actual_hours) FILTER (WHERE lea.project_id = p.id), 1)::TEXT || 'h)',
      ', ' 
      ORDER BY SUM(lea.actual_hours) FILTER (WHERE lea.project_id = p.id) DESC
    ) as projects_and_hours,
    MAX(CASE 
      WHEN ROW_NUMBER() OVER (
        PARTITION BY lea.employee_id, lea.work_date 
        ORDER BY SUM(lea.actual_hours) FILTER (WHERE lea.project_id = p.id) DESC, p.job_number ASC
      ) = 1 
      THEN p.job_number 
    END) as should_get_perdiem
  FROM public.labor_employee_actuals lea
  INNER JOIN perdiem_projects p ON p.id = lea.project_id
  INNER JOIN public.employees e ON e.id = lea.employee_id
  WHERE lea.actual_hours > 0
  GROUP BY lea.employee_id, e.name, lea.work_date, p.id, p.job_number
)

-- Summary statistics
SELECT 
  'SUMMARY STATISTICS' as report_section,
  NULL as employee_name,
  NULL as work_date,
  COUNT(DISTINCT employee_id || '-' || work_date) as unique_cases,
  COUNT(DISTINCT employee_id) as affected_employees,
  COUNT(DISTINCT work_date) as affected_days,
  NULL as projects_and_hours,
  NULL as winner_project
FROM multi_project_days
WHERE projects_worked > 1

UNION ALL

SELECT 
  '---' as report_section,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL

UNION ALL

-- Detailed list (top 50)
SELECT 
  'DETAILED LIST' as report_section,
  employee_name,
  work_date::TEXT,
  projects_worked,
  NULL as affected_employees,
  total_hours,
  projects_and_hours,
  should_get_perdiem as winner_project
FROM (
  SELECT 
    employee_id,
    employee_name,
    work_date,
    COUNT(*) as projects_worked,
    SUM(total_hours) as total_hours,
    STRING_AGG(projects_and_hours, ' + ') as projects_and_hours,
    MAX(should_get_perdiem) as should_get_perdiem
  FROM multi_project_days
  GROUP BY employee_id, employee_name, work_date
  HAVING COUNT(*) > 1
  ORDER BY work_date DESC, employee_id
  LIMIT 50
) details

ORDER BY 
  CASE report_section 
    WHEN 'SUMMARY STATISTICS' THEN 1 
    WHEN '---' THEN 2
    ELSE 3 
  END,
  work_date DESC;