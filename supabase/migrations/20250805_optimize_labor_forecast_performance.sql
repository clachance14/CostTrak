-- =====================================================
-- Optimize Labor Forecast API Performance
-- =====================================================
-- This migration adds indexes and functions to improve performance
-- of labor forecast APIs by aggregating at category level
-- (Direct, Indirect, Staff) instead of craft type level

-- =====================================================
-- 1. Add indexes for common query patterns
-- =====================================================

-- Composite index for labor_employee_actuals queries
CREATE INDEX IF NOT EXISTS idx_labor_employee_actuals_project_week 
  ON labor_employee_actuals(project_id, week_ending DESC);

-- Index for employee category lookups
CREATE INDEX IF NOT EXISTS idx_employees_id_category 
  ON employees(id, category);

-- Composite index for headcount forecasts
CREATE INDEX IF NOT EXISTS idx_labor_headcount_forecasts_project_week 
  ON labor_headcount_forecasts(project_id, week_starting);

-- Index for craft types category lookup
CREATE INDEX IF NOT EXISTS idx_craft_types_id_category 
  ON craft_types(id, category);

-- =====================================================
-- 2. Create function to get category rates
-- =====================================================
CREATE OR REPLACE FUNCTION get_labor_category_rates(
  p_project_id UUID,
  p_weeks_back INT DEFAULT 8
) RETURNS TABLE (
  category VARCHAR,
  avg_rate NUMERIC,
  total_hours NUMERIC,
  total_cost NUMERIC,
  week_count INT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT CURRENT_DATE - (p_weeks_back * 7) * INTERVAL '1 day' as start_date
  ),
  actuals_by_category AS (
    SELECT 
      COALESCE(e.category, 'direct') as category,
      SUM(lea.st_hours + lea.ot_hours) as total_hours,
      SUM(lea.st_wages + lea.ot_wages) as total_wages,
      SUM(lea.st_wages * 0.28) as total_burden,
      COUNT(DISTINCT lea.week_ending) as week_count
    FROM labor_employee_actuals lea
    JOIN employees e ON lea.employee_id = e.id
    CROSS JOIN date_range dr
    WHERE lea.project_id = p_project_id
      AND lea.week_ending >= dr.start_date
      AND (lea.st_hours + lea.ot_hours) > 0
    GROUP BY e.category
  )
  SELECT 
    abc.category::VARCHAR,
    CASE 
      WHEN abc.total_hours > 0 
      THEN (abc.total_wages + abc.total_burden) / abc.total_hours
      ELSE 0 
    END::NUMERIC as avg_rate,
    abc.total_hours::NUMERIC,
    (abc.total_wages + abc.total_burden)::NUMERIC as total_cost,
    abc.week_count::INT
  FROM actuals_by_category abc
  WHERE abc.category IN ('direct', 'indirect', 'staff');
END;
$$;

-- =====================================================
-- 3. Create function to get weekly actuals by category
-- =====================================================
CREATE OR REPLACE FUNCTION get_weekly_actuals_by_category(
  p_project_id UUID,
  p_week_ending DATE DEFAULT NULL
) RETURNS TABLE (
  week_ending DATE,
  category VARCHAR,
  total_hours NUMERIC,
  total_cost NUMERIC,
  employee_count INT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lea.week_ending::DATE,
    COALESCE(e.category, 'direct')::VARCHAR as category,
    SUM(lea.st_hours + lea.ot_hours)::NUMERIC as total_hours,
    SUM(lea.st_wages + lea.ot_wages + (lea.st_wages * 0.28))::NUMERIC as total_cost,
    COUNT(DISTINCT lea.employee_id)::INT as employee_count
  FROM labor_employee_actuals lea
  JOIN employees e ON lea.employee_id = e.id
  WHERE lea.project_id = p_project_id
    AND (p_week_ending IS NULL OR lea.week_ending = p_week_ending)
    AND e.category IN ('direct', 'indirect', 'staff')
  GROUP BY lea.week_ending, e.category
  ORDER BY lea.week_ending DESC, e.category;
END;
$$;

-- =====================================================
-- 4. Create function for composite rate calculation
-- =====================================================
CREATE OR REPLACE FUNCTION get_composite_labor_rate(
  p_project_id UUID,
  p_weeks_back INT DEFAULT 12,
  p_categories TEXT[] DEFAULT ARRAY['direct', 'indirect', 'staff']
) RETURNS TABLE (
  overall_rate NUMERIC,
  total_hours NUMERIC,
  total_cost NUMERIC,
  category_breakdown JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category_data JSONB;
BEGIN
  -- Calculate category breakdown
  WITH date_range AS (
    SELECT CURRENT_DATE - (p_weeks_back * 7) * INTERVAL '1 day' as start_date
  ),
  category_totals AS (
    SELECT 
      e.category,
      SUM(lea.st_hours + lea.ot_hours) as hours,
      SUM(lea.st_wages + lea.ot_wages + (lea.st_wages * 0.28)) as cost
    FROM labor_employee_actuals lea
    JOIN employees e ON lea.employee_id = e.id
    CROSS JOIN date_range dr
    WHERE lea.project_id = p_project_id
      AND lea.week_ending >= dr.start_date
      AND (lea.st_hours + lea.ot_hours) > 0
      AND e.category = ANY(p_categories)
    GROUP BY e.category
  )
  SELECT 
    jsonb_object_agg(
      category, 
      jsonb_build_object(
        'hours', hours,
        'cost', cost,
        'rate', CASE WHEN hours > 0 THEN cost / hours ELSE 0 END
      )
    ) INTO v_category_data
  FROM category_totals;

  -- Return overall totals and breakdown
  RETURN QUERY
  WITH totals AS (
    SELECT 
      SUM((value->>'hours')::numeric) as total_hours,
      SUM((value->>'cost')::numeric) as total_cost
    FROM jsonb_each(COALESCE(v_category_data, '{}'::jsonb))
  )
  SELECT 
    CASE 
      WHEN total_hours > 0 THEN total_cost / total_hours 
      ELSE 0 
    END::NUMERIC as overall_rate,
    COALESCE(total_hours, 0)::NUMERIC,
    COALESCE(total_cost, 0)::NUMERIC,
    COALESCE(v_category_data, '{}'::jsonb) as category_breakdown
  FROM totals;
END;
$$;

-- =====================================================
-- 5. Create function for headcount forecast rates
-- =====================================================
CREATE OR REPLACE FUNCTION get_headcount_category_rates(
  p_project_id UUID,
  p_weeks_back INT DEFAULT 8
) RETURNS TABLE (
  category VARCHAR,
  avg_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT CURRENT_DATE - (p_weeks_back * 7) * INTERVAL '1 day' as start_date
  ),
  category_rates AS (
    SELECT 
      ct.category,
      SUM(lea.st_hours + lea.ot_hours) as total_hours,
      SUM(lea.st_wages + lea.ot_wages + (lea.st_wages * 0.28)) as total_cost
    FROM labor_employee_actuals lea
    JOIN employees e ON lea.employee_id = e.id
    JOIN craft_types ct ON e.craft_type_id = ct.id
    CROSS JOIN date_range dr
    WHERE lea.project_id = p_project_id
      AND lea.week_ending >= dr.start_date
      AND (lea.st_hours + lea.ot_hours) > 0
      AND ct.category IN ('direct', 'indirect', 'staff')
    GROUP BY ct.category
  )
  SELECT 
    cr.category::VARCHAR,
    CASE 
      WHEN cr.total_hours > 0 THEN cr.total_cost / cr.total_hours
      ELSE 0
    END::NUMERIC as avg_rate
  FROM category_rates cr
  UNION ALL
  -- Include categories with no data
  SELECT 
    cat::VARCHAR,
    0::NUMERIC
  FROM unnest(ARRAY['direct', 'indirect', 'staff']) cat
  WHERE cat NOT IN (SELECT category FROM category_rates);
END;
$$;

-- =====================================================
-- 6. Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION get_labor_category_rates TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_actuals_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION get_composite_labor_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_headcount_category_rates TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_labor_category_rates IS 'Get average labor rates by category for a project over specified weeks';
COMMENT ON FUNCTION get_weekly_actuals_by_category IS 'Get weekly labor actuals aggregated by category';
COMMENT ON FUNCTION get_composite_labor_rate IS 'Calculate composite labor rate across specified categories';
COMMENT ON FUNCTION get_headcount_category_rates IS 'Get category-level rates for headcount forecasting';