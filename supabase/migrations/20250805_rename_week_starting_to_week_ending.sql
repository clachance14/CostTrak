-- Rename week_starting to week_ending in labor_headcount_forecasts table
-- This standardizes on week ending dates throughout the system

-- Rename the column
ALTER TABLE labor_headcount_forecasts 
RENAME COLUMN week_starting TO week_ending;

-- Update any indexes if they exist
-- Note: Indexes will automatically be updated with the column rename

-- Update RLS policies if they reference the column
-- (RLS policies will automatically use the new column name)