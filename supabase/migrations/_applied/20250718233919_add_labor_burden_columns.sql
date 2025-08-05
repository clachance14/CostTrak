-- Add burden-related columns to labor_employee_actuals table
DO $$ BEGIN
  -- Add burden_rate column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_employee_actuals' AND column_name = 'burden_rate') THEN
    ALTER TABLE labor_employee_actuals ADD COLUMN burden_rate DECIMAL(5,4) DEFAULT 0.28;
  END IF;
  
  -- Add st_burden_amount column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_employee_actuals' AND column_name = 'st_burden_amount') THEN
    ALTER TABLE labor_employee_actuals ADD COLUMN st_burden_amount DECIMAL(12,2) GENERATED ALWAYS AS (st_wages * burden_rate) STORED;
  END IF;
  
  -- Add total_burden_amount column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_employee_actuals' AND column_name = 'total_burden_amount') THEN
    ALTER TABLE labor_employee_actuals ADD COLUMN total_burden_amount DECIMAL(12,2) GENERATED ALWAYS AS (st_wages * burden_rate) STORED;
  END IF;
  
  -- Add st_wages_with_burden column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_employee_actuals' AND column_name = 'st_wages_with_burden') THEN
    ALTER TABLE labor_employee_actuals ADD COLUMN st_wages_with_burden DECIMAL(12,2) GENERATED ALWAYS AS (st_wages * (1 + burden_rate)) STORED;
  END IF;
  
  -- Add total_cost_with_burden column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_employee_actuals' AND column_name = 'total_cost_with_burden') THEN
    ALTER TABLE labor_employee_actuals ADD COLUMN total_cost_with_burden DECIMAL(12,2) GENERATED ALWAYS AS (st_wages * (1 + burden_rate) + ot_wages) STORED;
  END IF;
END $$;

-- Add similar columns to labor_actuals for aggregated data
DO $$ BEGIN
  -- Add burden_rate column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_actuals' AND column_name = 'burden_rate') THEN
    ALTER TABLE labor_actuals ADD COLUMN burden_rate DECIMAL(5,4) DEFAULT 0.28;
  END IF;
  
  -- Add burden_amount column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_actuals' AND column_name = 'burden_amount') THEN
    ALTER TABLE labor_actuals ADD COLUMN burden_amount DECIMAL(12,2) DEFAULT 0;
  END IF;
  
  -- Add actual_cost_with_burden column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labor_actuals' AND column_name = 'actual_cost_with_burden') THEN
    ALTER TABLE labor_actuals ADD COLUMN actual_cost_with_burden DECIMAL(12,2) DEFAULT 0;
  END IF;
END $$;

-- Create index on burden columns for better query performance
CREATE INDEX IF NOT EXISTS idx_labor_employee_actuals_burden ON labor_employee_actuals(project_id, week_ending, total_cost_with_burden);
CREATE INDEX IF NOT EXISTS idx_labor_actuals_burden ON labor_actuals(project_id, week_ending, actual_cost_with_burden);

-- Update existing records to calculate burden amounts for labor_actuals
-- This will set the burden amounts based on the 28% rate
UPDATE labor_actuals
SET 
  burden_amount = actual_cost * burden_rate,
  actual_cost_with_burden = actual_cost * (1 + burden_rate)
WHERE burden_amount = 0 OR actual_cost_with_burden = 0;

-- Add comment to document the burden rate
COMMENT ON COLUMN labor_employee_actuals.burden_rate IS 'Tax and insurance burden rate applied to straight time wages only (default 28%)';
COMMENT ON COLUMN labor_employee_actuals.st_burden_amount IS 'Burden amount calculated on straight time wages only';
COMMENT ON COLUMN labor_employee_actuals.total_burden_amount IS 'Total burden amount (same as st_burden_amount since OT is not burdened)';
COMMENT ON COLUMN labor_employee_actuals.st_wages_with_burden IS 'Straight time wages including burden';
COMMENT ON COLUMN labor_employee_actuals.total_cost_with_burden IS 'Total cost including ST burden and OT wages (OT not burdened)';

COMMENT ON COLUMN labor_actuals.burden_rate IS 'Tax and insurance burden rate (default 28%)';
COMMENT ON COLUMN labor_actuals.burden_amount IS 'Total burden amount for the week';
COMMENT ON COLUMN labor_actuals.actual_cost_with_burden IS 'Total actual cost including burden';