-- Migration: Enhance employees table with additional fields
-- Add new columns to match spreadsheet data structure

-- Add new columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS payroll_name text,
ADD COLUMN IF NOT EXISTS legal_middle_name text,
ADD COLUMN IF NOT EXISTS location_code text,
ADD COLUMN IF NOT EXISTS location_description text,
ADD COLUMN IF NOT EXISTS class text,
ADD COLUMN IF NOT EXISTS job_title_description text,
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('Direct', 'Indirect', 'Staff'));

-- Update existing records to set category based on is_direct boolean
UPDATE public.employees 
SET category = CASE 
  WHEN is_direct = true THEN 'Direct'
  ELSE 'Indirect'
END
WHERE category IS NULL;

-- Make category NOT NULL after migration
ALTER TABLE public.employees ALTER COLUMN category SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.employees.payroll_name IS 'Full name in "Last, First" format as shown in payroll';
COMMENT ON COLUMN public.employees.legal_middle_name IS 'Legal middle name or initial';
COMMENT ON COLUMN public.employees.location_code IS 'Location code (e.g., F for Freeport)';
COMMENT ON COLUMN public.employees.location_description IS 'Full location description (e.g., Freeport)';
COMMENT ON COLUMN public.employees.class IS 'Pay grade/class code (e.g., CSF, QCS, CSA)';
COMMENT ON COLUMN public.employees.job_title_description IS 'Full job title description';
COMMENT ON COLUMN public.employees.category IS 'Labor category: Direct, Indirect, or Staff';

-- Note: Keep is_direct for backward compatibility during transition
-- It can be removed in a future migration after all code is updated to use category