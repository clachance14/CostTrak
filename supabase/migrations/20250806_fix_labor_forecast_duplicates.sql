-- Fix duplicate labor forecast entries and add unique constraint
-- This migration:
-- 1. Normalizes all dates to Sunday (week ending)
-- 2. Removes duplicate entries keeping the most recent
-- 3. Adds unique constraint to prevent future duplicates

-- Step 1: Create temporary table with normalized dates and ranked duplicates
CREATE TEMP TABLE normalized_forecasts AS
WITH normalized AS (
  SELECT 
    id,
    project_id,
    craft_type_id,
    -- Normalize to Sunday (week ending)
    -- If it's Monday, it was likely meant to be the previous Sunday
    -- For other days, adjust to the next Sunday (end of that week)
    CASE 
      WHEN EXTRACT(DOW FROM week_ending::date) = 0 THEN week_ending::date  -- Already Sunday
      WHEN EXTRACT(DOW FROM week_ending::date) = 1 THEN (week_ending::date - INTERVAL '1 day')::date  -- Monday -> Previous Sunday
      ELSE (week_ending::date + (7 - EXTRACT(DOW FROM week_ending::date))::int * INTERVAL '1 day')::date  -- Other days -> Next Sunday
    END AS normalized_week_ending,
    headcount,
    avg_weekly_hours,
    notes,
    created_at,
    updated_at,
    division_id,
    -- Rank duplicates by updated_at (most recent first)
    ROW_NUMBER() OVER (
      PARTITION BY 
        project_id, 
        craft_type_id,
        CASE 
          WHEN EXTRACT(DOW FROM week_ending::date) = 0 THEN week_ending::date  -- Already Sunday
          WHEN EXTRACT(DOW FROM week_ending::date) = 1 THEN (week_ending::date - INTERVAL '1 day')::date  -- Monday -> Previous Sunday
          ELSE (week_ending::date + (7 - EXTRACT(DOW FROM week_ending::date))::int * INTERVAL '1 day')::date  -- Other days -> Next Sunday
        END
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM labor_headcount_forecasts
)
SELECT * FROM normalized;

-- Step 2: Delete all duplicates (keeping only rank 1)
DELETE FROM labor_headcount_forecasts
WHERE id IN (
  SELECT id FROM normalized_forecasts WHERE rn > 1
);

-- Step 3: Update remaining entries to have normalized Sunday dates
UPDATE labor_headcount_forecasts lhf
SET week_ending = nf.normalized_week_ending
FROM normalized_forecasts nf
WHERE lhf.id = nf.id
  AND lhf.week_ending != nf.normalized_week_ending
  AND nf.rn = 1;

-- Step 4: Drop the temporary table
DROP TABLE normalized_forecasts;

-- Step 5: Add unique constraint to prevent future duplicates
-- First check if constraint already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_project_craft_week'
  ) THEN
    ALTER TABLE labor_headcount_forecasts
    ADD CONSTRAINT unique_project_craft_week 
    UNIQUE (project_id, craft_type_id, week_ending);
  END IF;
END $$;

-- Step 6: Add index for better query performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_labor_headcount_forecasts_lookup
ON labor_headcount_forecasts(project_id, craft_type_id, week_ending);

-- Log the migration results
DO $$
DECLARE
  total_before integer;
  total_after integer;
  duplicates_removed integer;
BEGIN
  -- Get counts (these are just for logging, actual deletion already happened)
  SELECT COUNT(*) INTO total_after FROM labor_headcount_forecasts;
  
  RAISE NOTICE 'Labor forecast duplicates cleanup completed';
  RAISE NOTICE 'Remaining records: %', total_after;
  RAISE NOTICE 'All dates normalized to Sunday week endings';
  RAISE NOTICE 'Unique constraint added to prevent future duplicates';
END $$;