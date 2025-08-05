-- =====================================================
-- Fix Ambiguous Column References in Labor Functions
-- =====================================================
-- This migration fixes SQL errors caused by ambiguous column names

-- =====================================================
-- 1. Fix get_composite_labor_rate function
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
  v_total_hours NUMERIC;
  v_total_cost NUMERIC;
BEGIN
  -- Calculate category breakdown with explicit aliases
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
      ct.category, 
      jsonb_build_object(
        'hours', ct.hours,
        'cost', ct.cost,
        'rate', CASE WHEN ct.hours > 0 THEN ct.cost / ct.hours ELSE 0 END
      )
    ) INTO v_category_data
  FROM category_totals ct;

  -- Calculate totals from the category data
  SELECT 
    SUM((value->>'hours')::numeric),
    SUM((value->>'cost')::numeric)
  INTO v_total_hours, v_total_cost
  FROM jsonb_each(COALESCE(v_category_data, '{}'::jsonb));

  -- Return overall totals and breakdown
  RETURN QUERY
  SELECT 
    CASE 
      WHEN COALESCE(v_total_hours, 0) > 0 THEN COALESCE(v_total_cost, 0) / v_total_hours 
      ELSE 0 
    END::NUMERIC as overall_rate,
    COALESCE(v_total_hours, 0)::NUMERIC,
    COALESCE(v_total_cost, 0)::NUMERIC,
    COALESCE(v_category_data, '{}'::jsonb) as category_breakdown;
END;
$$;

-- =====================================================
-- 2. Fix get_headcount_category_rates function
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
      ct.category as cat_name,
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
    cr.cat_name::VARCHAR,
    CASE 
      WHEN cr.total_hours > 0 THEN cr.total_cost / cr.total_hours
      ELSE 0
    END::NUMERIC as avg_rate
  FROM category_rates cr
  UNION ALL
  -- Include categories with no data
  SELECT 
    cat::VARCHAR,
    0::NUMERIC as avg_rate
  FROM unnest(ARRAY['direct', 'indirect', 'staff']) cat
  WHERE cat NOT IN (SELECT cat_name FROM category_rates);
END;
$$;

-- =====================================================
-- 3. Fix get_weekly_actuals_by_category to ensure it works
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
    COALESCE(e.category, 'direct')::VARCHAR,
    SUM(lea.st_hours + lea.ot_hours)::NUMERIC as total_hours,
    SUM(lea.st_wages + lea.ot_wages + (lea.st_wages * 0.28))::NUMERIC as total_cost,
    COUNT(DISTINCT lea.employee_id)::INT as employee_count
  FROM labor_employee_actuals lea
  JOIN employees e ON lea.employee_id = e.id
  WHERE lea.project_id = p_project_id
    AND (p_week_ending IS NULL OR lea.week_ending = p_week_ending)
    AND e.category IN ('direct', 'indirect', 'staff')
    AND (lea.st_hours + lea.ot_hours) > 0  -- Only include records with hours
  GROUP BY lea.week_ending, e.category
  ORDER BY lea.week_ending DESC, e.category;
END;
$$;

-- =====================================================
-- 4. Also update get_labor_category_rates for consistency
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
      COALESCE(e.category, 'direct') as cat_name,
      SUM(lea.st_hours + lea.ot_hours) as sum_hours,
      SUM(lea.st_wages + lea.ot_wages) as sum_wages,
      SUM(lea.st_wages * 0.28) as sum_burden,
      COUNT(DISTINCT lea.week_ending) as weeks
    FROM labor_employee_actuals lea
    JOIN employees e ON lea.employee_id = e.id
    CROSS JOIN date_range dr
    WHERE lea.project_id = p_project_id
      AND lea.week_ending >= dr.start_date
      AND (lea.st_hours + lea.ot_hours) > 0
      AND e.category IN ('direct', 'indirect', 'staff')
    GROUP BY e.category
  )
  SELECT 
    abc.cat_name::VARCHAR,
    CASE 
      WHEN abc.sum_hours > 0 
      THEN (abc.sum_wages + abc.sum_burden) / abc.sum_hours
      ELSE 0 
    END::NUMERIC as avg_rate,
    abc.sum_hours::NUMERIC,
    (abc.sum_wages + abc.sum_burden)::NUMERIC as total_cost,
    abc.weeks::INT
  FROM actuals_by_category abc;
END;
$$;

-- Grant permissions (in case they were lost)
GRANT EXECUTE ON FUNCTION get_labor_category_rates TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_actuals_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION get_composite_labor_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_headcount_category_rates TO authenticated;