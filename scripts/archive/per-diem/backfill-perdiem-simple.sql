-- Simple Per Diem Backfill Migration
-- Run this to backfill per diem costs for all projects

-- 1. Backfill per diem costs for all projects with per diem enabled
DO $$
DECLARE
  project_record RECORD;
  result JSON;
  total_projects INTEGER := 0;
  total_amount DECIMAL(10,2) := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting Per Diem Backfill';
  RAISE NOTICE '========================================';
  
  -- Loop through all projects with per diem enabled
  FOR project_record IN 
    SELECT id, name, job_number, per_diem_rate_direct, per_diem_rate_indirect
    FROM public.projects
    WHERE per_diem_enabled = true
  LOOP
    -- Recalculate per diem for each project
    SELECT recalculate_project_per_diem(project_record.id) INTO result;
    
    total_projects := total_projects + 1;
    total_amount := total_amount + COALESCE((result->>'total_per_diem_amount')::DECIMAL, 0);
    
    RAISE NOTICE 'Project % (%): $% per diem calculated', 
      project_record.name, 
      project_record.job_number,
      COALESCE((result->>'total_per_diem_amount')::DECIMAL, 0);
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Per Diem Backfill Complete!';
  RAISE NOTICE '   Projects processed: %', total_projects;
  RAISE NOTICE '   Total per diem amount: $%', total_amount;
  RAISE NOTICE '========================================';
END $$;

-- 2. Show summary of per diem costs
SELECT 
  p.name AS project_name,
  p.job_number,
  p.per_diem_rate_direct,
  p.per_diem_rate_indirect,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS days_with_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Direct' THEN pdc.amount ELSE 0 END) AS direct_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Indirect' THEN pdc.amount ELSE 0 END) AS indirect_per_diem,
  SUM(pdc.amount) AS total_per_diem
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.id, p.name, p.job_number, p.per_diem_rate_direct, p.per_diem_rate_indirect
ORDER BY p.job_number;