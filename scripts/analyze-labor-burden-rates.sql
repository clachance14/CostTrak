-- =====================================================
-- Labor Employee Actuals - Burden Rate Analysis Script
-- =====================================================
-- This script analyzes the burden rate calculations in labor_employee_actuals
-- to ensure mathematical accuracy. Burden should be 28% on ST wages only.

-- 1. Check burden rate distribution
-- Expected: All records should have 0.28 (28%) burden rate
SELECT 
    'Burden Rate Distribution' as analysis_type,
    burden_rate,
    COUNT(*) as record_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM labor_employee_actuals
GROUP BY burden_rate
ORDER BY burden_rate;

-- 2. Verify burden calculations on straight time wages
-- Should show no mismatches if calculations are correct
WITH burden_check AS (
    SELECT 
        id,
        employee_id,
        project_id,
        week_ending,
        st_wages,
        ot_wages,
        burden_rate,
        st_burden_amount,
        total_burden_amount,
        st_wages_with_burden,
        total_cost_with_burden,
        -- Expected calculations
        st_wages * burden_rate as expected_st_burden,
        st_wages * (1 + burden_rate) as expected_st_with_burden,
        st_wages * (1 + burden_rate) + ot_wages as expected_total_with_burden
    FROM labor_employee_actuals
    WHERE st_wages > 0 OR ot_wages > 0
)
SELECT 
    'Burden Calculation Accuracy' as analysis_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ABS(st_burden_amount - expected_st_burden) > 0.01 THEN 1 END) as st_burden_mismatches,
    COUNT(CASE WHEN ABS(total_burden_amount - expected_st_burden) > 0.01 THEN 1 END) as total_burden_mismatches,
    COUNT(CASE WHEN ABS(st_wages_with_burden - expected_st_with_burden) > 0.01 THEN 1 END) as st_with_burden_mismatches,
    COUNT(CASE WHEN ABS(total_cost_with_burden - expected_total_with_burden) > 0.01 THEN 1 END) as total_with_burden_mismatches
FROM burden_check;

-- 3. Show sample of any calculation mismatches
WITH burden_errors AS (
    SELECT 
        id,
        employee_id,
        project_id,
        week_ending,
        st_wages,
        ot_wages,
        burden_rate,
        st_burden_amount,
        st_wages * burden_rate as expected_st_burden,
        total_cost_with_burden,
        st_wages * (1 + burden_rate) + ot_wages as expected_total_with_burden,
        ABS(total_cost_with_burden - (st_wages * (1 + burden_rate) + ot_wages)) as difference
    FROM labor_employee_actuals
    WHERE st_wages > 0 
    AND ABS(total_cost_with_burden - (st_wages * (1 + burden_rate) + ot_wages)) > 0.01
)
SELECT 
    'Sample Calculation Errors' as analysis_type,
    id,
    week_ending,
    st_wages,
    ot_wages,
    burden_rate,
    st_burden_amount,
    expected_st_burden,
    total_cost_with_burden,
    expected_total_with_burden,
    difference
FROM burden_errors
LIMIT 10;

-- 4. Verify overtime is NOT burdened
-- The total burden should equal ST burden (no burden on OT)
SELECT 
    'OT Burden Verification' as analysis_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN st_burden_amount != total_burden_amount THEN 1 END) as records_with_ot_burden,
    COUNT(CASE WHEN ot_wages > 0 AND st_burden_amount != total_burden_amount THEN 1 END) as ot_records_with_wrong_burden
FROM labor_employee_actuals
WHERE st_wages > 0 OR ot_wages > 0;

-- 5. Summary statistics by project and week
SELECT 
    'Weekly Project Summary' as analysis_type,
    p.job_number,
    p.name as project_name,
    lea.week_ending,
    COUNT(DISTINCT lea.employee_id) as employee_count,
    SUM(lea.st_hours) as total_st_hours,
    SUM(lea.ot_hours) as total_ot_hours,
    SUM(lea.st_wages) as total_st_wages,
    SUM(lea.ot_wages) as total_ot_wages,
    AVG(lea.burden_rate) as avg_burden_rate,
    SUM(lea.st_burden_amount) as total_burden,
    SUM(lea.total_cost_with_burden) as total_cost_with_burden,
    -- Verify aggregated burden calculation
    SUM(lea.st_wages) * 0.28 as expected_burden,
    ABS(SUM(lea.st_burden_amount) - SUM(lea.st_wages) * 0.28) as burden_difference
FROM labor_employee_actuals lea
JOIN projects p ON p.id = lea.project_id
WHERE lea.st_wages > 0 OR lea.ot_wages > 0
GROUP BY p.job_number, p.name, lea.week_ending
HAVING ABS(SUM(lea.st_burden_amount) - SUM(lea.st_wages) * 0.28) > 0.01
ORDER BY lea.week_ending DESC, p.job_number
LIMIT 20;

-- 6. Check for employees with zero base rates affecting calculations
SELECT 
    'Zero Base Rate Impact' as analysis_type,
    e.employee_number,
    e.first_name || ' ' || e.last_name as employee_name,
    e.base_rate,
    COUNT(DISTINCT lea.week_ending) as weeks_worked,
    SUM(lea.st_hours) as total_st_hours,
    SUM(lea.ot_hours) as total_ot_hours,
    SUM(lea.st_wages) as total_st_wages,
    SUM(lea.ot_wages) as total_ot_wages
FROM employees e
JOIN labor_employee_actuals lea ON lea.employee_id = e.id
WHERE e.base_rate = 0
AND (lea.st_hours > 0 OR lea.ot_hours > 0)
GROUP BY e.employee_number, e.first_name, e.last_name, e.base_rate
ORDER BY total_st_hours DESC
LIMIT 20;

-- 7. Verify labor_actuals aggregation matches employee actuals
WITH employee_totals AS (
    SELECT 
        project_id,
        week_ending,
        SUM(st_hours + ot_hours) as total_hours,
        SUM(st_wages + ot_wages) as total_wages,
        SUM(st_wages) * 0.28 as total_burden,
        SUM(st_wages * 1.28 + ot_wages) as total_with_burden
    FROM labor_employee_actuals lea
    JOIN employees e ON e.id = lea.employee_id
    WHERE e.category = 'Direct' -- Check one category at a time
    GROUP BY project_id, week_ending
),
actuals_totals AS (
    SELECT 
        la.project_id,
        la.week_ending,
        la.actual_hours,
        la.actual_cost,
        la.burden_amount,
        la.actual_cost_with_burden
    FROM labor_actuals la
    JOIN craft_types ct ON ct.id = la.craft_type_id
    WHERE ct.category = 'direct'
)
SELECT 
    'Direct Labor Aggregation Check' as analysis_type,
    et.week_ending,
    et.total_hours as employee_total_hours,
    at.actual_hours as actuals_total_hours,
    ABS(et.total_hours - at.actual_hours) as hours_diff,
    et.total_wages as employee_total_wages,
    at.actual_cost as actuals_total_cost,
    ABS(et.total_wages - at.actual_cost) as wages_diff,
    et.total_burden as employee_total_burden,
    at.burden_amount as actuals_burden,
    ABS(et.total_burden - at.burden_amount) as burden_diff
FROM employee_totals et
LEFT JOIN actuals_totals at ON et.project_id = at.project_id AND et.week_ending = at.week_ending
WHERE ABS(et.total_wages - COALESCE(at.actual_cost, 0)) > 1.00
ORDER BY et.week_ending DESC
LIMIT 20;

-- 8. Final summary of burden rate health
WITH burden_stats AS (
    SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN burden_rate = 0.28 THEN 1 END) as correct_rate_count,
        COUNT(CASE WHEN burden_rate != 0.28 THEN 1 END) as incorrect_rate_count,
        COUNT(CASE WHEN st_wages > 0 THEN 1 END) as records_with_st,
        COUNT(CASE WHEN ot_wages > 0 THEN 1 END) as records_with_ot,
        SUM(st_wages) as total_st_wages,
        SUM(ot_wages) as total_ot_wages,
        SUM(st_burden_amount) as total_burden_amount,
        SUM(total_cost_with_burden) as grand_total_with_burden
    FROM labor_employee_actuals
)
SELECT 
    'Overall Burden Health Check' as analysis_type,
    total_records,
    correct_rate_count,
    incorrect_rate_count,
    ROUND(correct_rate_count * 100.0 / NULLIF(total_records, 0), 2) as correct_rate_percentage,
    records_with_st,
    records_with_ot,
    ROUND(total_st_wages, 2) as total_st_wages,
    ROUND(total_ot_wages, 2) as total_ot_wages,
    ROUND(total_burden_amount, 2) as total_burden_amount,
    ROUND(total_st_wages * 0.28, 2) as expected_burden_amount,
    ROUND(ABS(total_burden_amount - total_st_wages * 0.28), 2) as burden_variance,
    ROUND(grand_total_with_burden, 2) as grand_total_with_burden,
    ROUND(total_st_wages * 1.28 + total_ot_wages, 2) as expected_total_with_burden,
    ROUND(ABS(grand_total_with_burden - (total_st_wages * 1.28 + total_ot_wages)), 2) as total_variance
FROM burden_stats;