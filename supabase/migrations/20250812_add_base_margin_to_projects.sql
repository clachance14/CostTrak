-- Add base_margin_percentage field to projects table
-- This field stores the target margin percentage for the project
-- Used for early-stage budget projections and risk assessment

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS base_margin_percentage DECIMAL(5,2) DEFAULT 15.00;

-- Add comment for documentation
COMMENT ON COLUMN projects.base_margin_percentage IS 'Target profit margin percentage for the project (e.g., 15.00 for 15%). Used for early-stage projections before actual data is available.';

-- Update existing projects with a reasonable default if needed
-- This can be adjusted per project by PMs
UPDATE projects 
SET base_margin_percentage = 15.00 
WHERE base_margin_percentage IS NULL;