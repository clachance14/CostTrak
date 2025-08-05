-- Allow decimal headcount values in labor_headcount_forecasts table
-- This supports partial headcount for part-time workers (e.g., 0.5, 1.5, etc.)

-- First, drop the existing check constraint
ALTER TABLE labor_headcount_forecasts 
DROP CONSTRAINT IF EXISTS labor_headcount_forecasts_headcount_check;

-- Change the column type from integer to numeric
ALTER TABLE labor_headcount_forecasts 
ALTER COLUMN headcount TYPE numeric(10,2);

-- Add back the check constraint for non-negative values
ALTER TABLE labor_headcount_forecasts 
ADD CONSTRAINT labor_headcount_forecasts_headcount_check 
CHECK (headcount >= 0);

-- Add a comment to document the change
COMMENT ON COLUMN labor_headcount_forecasts.headcount IS 'Number of workers, supports decimal values for partial headcount';