-- SQL to populate craft_types table from existing employee classes
-- This creates craft type entries with 'C' prefix to match labor import format

-- First, clear any sample data (if needed)
DELETE FROM public.craft_types 
WHERE code IN ('DIRECT', '01-100') 
  AND NOT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE employees.class = craft_types.code 
       OR ('C' || employees.class) = craft_types.code
  );

-- Insert unique class codes from employees with 'C' prefix
INSERT INTO public.craft_types (code, name, category, billing_rate, is_active)
SELECT DISTINCT 
  'C' || employees.class as code,           -- Add 'C' prefix to match import format
  employees.class as name,                  -- Name without prefix for display
  'direct' as category,                     -- Default category
  85.00 as billing_rate,                    -- Default billing rate (will be updated from imports)
  true as is_active
FROM public.employees 
WHERE employees.class IS NOT NULL 
  AND employees.class != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.craft_types 
    WHERE craft_types.code = 'C' || employees.class
  );

-- Optional: Update any existing craft types that might have wrong format
UPDATE public.craft_types
SET code = 'C' || code
WHERE LENGTH(code) > 0 
  AND NOT code LIKE 'C%'
  AND EXISTS (
    SELECT 1 FROM public.employees 
    WHERE employees.class = craft_types.code
  );

-- Show results
SELECT 
  ct.code,
  ct.name,
  ct.billing_rate,
  COUNT(DISTINCT e.id) as employee_count
FROM public.craft_types ct
LEFT JOIN public.employees e ON e.class = ct.name OR e.class = SUBSTRING(ct.code FROM 2)
GROUP BY ct.code, ct.name, ct.billing_rate
ORDER BY ct.code;