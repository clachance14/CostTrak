-- Test the headcount query directly
-- Check what's in the database
SELECT 
  id,
  project_id,
  craft_type_id,
  week_starting,
  headcount,
  weekly_hours,
  created_at
FROM labor_headcount_forecasts
WHERE project_id = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
ORDER BY week_starting;

-- Check the date range being queried
-- API is querying: gte '2025-03-11' and lte '2026-09-01'
SELECT 
  id,
  week_starting,
  headcount
FROM labor_headcount_forecasts
WHERE project_id = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
  AND week_starting >= '2025-03-11'
  AND week_starting <= '2026-09-01'
ORDER BY week_starting;

-- Check with join to craft_types
SELECT 
  lhf.week_starting,
  lhf.headcount,
  lhf.weekly_hours,
  lhf.craft_type_id,
  ct.id as ct_id,
  ct.name,
  ct.code,
  ct.category
FROM labor_headcount_forecasts lhf
INNER JOIN craft_types ct ON ct.id = lhf.craft_type_id
WHERE lhf.project_id = '90cc2a33-e02e-432d-abdb-c46b0e185a00'
  AND lhf.week_starting >= '2025-03-11'
  AND lhf.week_starting <= '2026-09-01'
ORDER BY lhf.week_starting;