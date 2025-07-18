-- Enhance projects table with data freshness tracking and physical progress
-- This enables the PM dashboard to show data health and real progress metrics

-- Add new columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS physical_percent_complete numeric DEFAULT 0 
  CHECK (physical_percent_complete >= 0 AND physical_percent_complete <= 100),
ADD COLUMN IF NOT EXISTS physical_progress_method varchar DEFAULT 'labor_hours' 
  CHECK (physical_progress_method IN ('labor_hours', 'units_installed', 'weighted_activities')),
ADD COLUMN IF NOT EXISTS last_labor_import_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_po_import_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS data_health_status varchar DEFAULT 'unknown' 
  CHECK (data_health_status IN ('current', 'stale', 'missing', 'unknown')),
ADD COLUMN IF NOT EXISTS data_health_checked_at timestamp with time zone;

-- Create function to update data health status
CREATE OR REPLACE FUNCTION update_project_data_health()
RETURNS void AS $$
DECLARE
  stale_threshold interval := '7 days';
BEGIN
  UPDATE public.projects
  SET 
    data_health_status = CASE
      WHEN last_labor_import_at IS NULL OR last_po_import_at IS NULL THEN 'missing'
      WHEN last_labor_import_at < NOW() - stale_threshold 
        OR last_po_import_at < NOW() - stale_threshold THEN 'stale'
      ELSE 'current'
    END,
    data_health_checked_at = NOW()
  WHERE status IN ('active', 'planning');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate physical progress from labor hours
CREATE OR REPLACE FUNCTION calculate_physical_progress_from_labor(p_project_id uuid)
RETURNS numeric AS $$
DECLARE
  total_planned_hours numeric;
  total_actual_hours numeric;
  progress numeric;
BEGIN
  -- Get total planned hours from budget breakdowns
  SELECT SUM(manhours) INTO total_planned_hours
  FROM public.project_budget_breakdowns
  WHERE project_id = p_project_id;
  
  -- Get total actual hours from labor actuals
  SELECT SUM(actual_hours) INTO total_actual_hours
  FROM public.labor_actuals
  WHERE project_id = p_project_id;
  
  -- Calculate progress
  IF total_planned_hours IS NOT NULL AND total_planned_hours > 0 THEN
    progress := LEAST(100, (COALESCE(total_actual_hours, 0) / total_planned_hours) * 100);
  ELSE
    progress := 0;
  END IF;
  
  RETURN ROUND(progress, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update last import timestamps
CREATE OR REPLACE FUNCTION update_project_import_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.import_status = 'success' THEN
    IF NEW.import_type = 'labor' THEN
      UPDATE public.projects 
      SET last_labor_import_at = NEW.imported_at
      WHERE id = NEW.project_id;
    ELSIF NEW.import_type = 'po' THEN
      UPDATE public.projects 
      SET last_po_import_at = NEW.imported_at
      WHERE id = NEW.project_id;
    END IF;
    
    -- Also update physical progress if it's a labor import
    IF NEW.import_type = 'labor' THEN
      UPDATE public.projects
      SET physical_percent_complete = calculate_physical_progress_from_labor(NEW.project_id)
      WHERE id = NEW.project_id
      AND physical_progress_method = 'labor_hours';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_project_on_import
  AFTER INSERT OR UPDATE ON public.data_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_project_import_timestamps();

-- Create indexes for new columns
CREATE INDEX idx_projects_data_health_status ON public.projects(data_health_status);
CREATE INDEX idx_projects_last_labor_import ON public.projects(last_labor_import_at);
CREATE INDEX idx_projects_last_po_import ON public.projects(last_po_import_at);

-- Add comments
COMMENT ON COLUMN public.projects.physical_percent_complete IS 'Physical progress percentage based on actual work completed';
COMMENT ON COLUMN public.projects.physical_progress_method IS 'Method used to calculate physical progress';
COMMENT ON COLUMN public.projects.last_labor_import_at IS 'Timestamp of last successful labor data import';
COMMENT ON COLUMN public.projects.last_po_import_at IS 'Timestamp of last successful PO data import';
COMMENT ON COLUMN public.projects.data_health_status IS 'Current data freshness status for dashboard alerts';
COMMENT ON COLUMN public.projects.data_health_checked_at IS 'Last time data health was evaluated';

-- Run initial data health update
SELECT update_project_data_health();