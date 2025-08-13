-- IMPORTANT: Run this migration in your Supabase SQL Editor
-- This adds per diem cost tracking support to CostTrak

-- Add per diem cost tracking support
-- This migration adds per diem rate configuration to projects and creates
-- a table to track calculated per diem costs based on labor actuals

-- Add per diem rate columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS per_diem_rate_direct DECIMAL(10,2) DEFAULT 0.00 
  CHECK (per_diem_rate_direct >= 0),
ADD COLUMN IF NOT EXISTS per_diem_rate_indirect DECIMAL(10,2) DEFAULT 0.00 
  CHECK (per_diem_rate_indirect >= 0),
ADD COLUMN IF NOT EXISTS per_diem_enabled BOOLEAN DEFAULT false;

-- Create per_diem_costs table to track calculated per diem costs
CREATE TABLE IF NOT EXISTS public.per_diem_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  employee_type VARCHAR(20) NOT NULL CHECK (employee_type IN ('Direct', 'Indirect')),
  rate_applied DECIMAL(10,2) NOT NULL,
  days_worked DECIMAL(5,2) DEFAULT 1.00,
  amount DECIMAL(10,2) NOT NULL,
  labor_actual_id UUID REFERENCES public.labor_employee_actuals(id) ON DELETE SET NULL,
  pay_period_ending DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique per diem entry per employee per day per project
  CONSTRAINT unique_per_diem_per_day UNIQUE (project_id, employee_id, work_date)
);

-- Create indexes for performance
CREATE INDEX idx_per_diem_costs_project_id ON public.per_diem_costs(project_id);
CREATE INDEX idx_per_diem_costs_employee_id ON public.per_diem_costs(employee_id);
CREATE INDEX idx_per_diem_costs_work_date ON public.per_diem_costs(work_date);
CREATE INDEX idx_per_diem_costs_pay_period ON public.per_diem_costs(pay_period_ending);
CREATE INDEX idx_per_diem_costs_labor_actual ON public.per_diem_costs(labor_actual_id);

-- Create function to calculate per diem for a labor actual entry
CREATE OR REPLACE FUNCTION calculate_per_diem_for_labor_actual()
RETURNS TRIGGER AS $$
DECLARE
  v_project_per_diem_enabled BOOLEAN;
  v_per_diem_rate_direct DECIMAL(10,2);
  v_per_diem_rate_indirect DECIMAL(10,2);
  v_employee_type VARCHAR(20);
  v_rate_to_apply DECIMAL(10,2);
  v_days_worked DECIMAL(5,2);
BEGIN
  -- Check if per diem is enabled for this project
  SELECT per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect
  INTO v_project_per_diem_enabled, v_per_diem_rate_direct, v_per_diem_rate_indirect
  FROM public.projects
  WHERE id = NEW.project_id;
  
  -- Exit if per diem is not enabled or rates are zero
  IF NOT v_project_per_diem_enabled OR 
     (v_per_diem_rate_direct = 0 AND v_per_diem_rate_indirect = 0) THEN
    RETURN NEW;
  END IF;
  
  -- Get employee type
  SELECT employee_type
  INTO v_employee_type
  FROM public.employees
  WHERE id = NEW.employee_id;
  
  -- Determine which rate to apply
  IF v_employee_type = 'Direct' THEN
    v_rate_to_apply := v_per_diem_rate_direct;
  ELSE
    v_rate_to_apply := v_per_diem_rate_indirect;
  END IF;
  
  -- Skip if rate is zero
  IF v_rate_to_apply = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Calculate days worked (assuming actual_hours > 0 means a day worked)
  -- Using ceiling to round up any partial day to a full day for per diem
  IF NEW.actual_hours > 0 THEN
    v_days_worked := 1.00;  -- Simplified: any hours worked = 1 day per diem
  ELSE
    v_days_worked := 0;
  END IF;
  
  -- Skip if no days worked
  IF v_days_worked = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Insert or update per diem cost record
  INSERT INTO public.per_diem_costs (
    project_id,
    employee_id,
    work_date,
    employee_type,
    rate_applied,
    days_worked,
    amount,
    labor_actual_id,
    pay_period_ending
  ) VALUES (
    NEW.project_id,
    NEW.employee_id,
    NEW.work_date,
    v_employee_type,
    v_rate_to_apply,
    v_days_worked,
    v_rate_to_apply * v_days_worked,
    NEW.id,
    NEW.pay_period_ending
  )
  ON CONFLICT (project_id, employee_id, work_date)
  DO UPDATE SET
    rate_applied = EXCLUDED.rate_applied,
    days_worked = EXCLUDED.days_worked,
    amount = EXCLUDED.amount,
    labor_actual_id = EXCLUDED.labor_actual_id,
    pay_period_ending = EXCLUDED.pay_period_ending,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to calculate per diem when labor actuals are inserted or updated
CREATE TRIGGER calculate_per_diem_on_labor_actual
  AFTER INSERT OR UPDATE ON public.labor_employee_actuals
  FOR EACH ROW
  EXECUTE FUNCTION calculate_per_diem_for_labor_actual();

-- Create function to recalculate all per diem for a project
CREATE OR REPLACE FUNCTION recalculate_project_per_diem(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_calculated INTEGER;
  v_total_amount DECIMAL(10,2);
BEGIN
  -- Delete existing per diem costs for the project
  DELETE FROM public.per_diem_costs
  WHERE project_id = p_project_id;
  
  -- Recalculate by triggering the function for all labor actuals
  WITH recalc AS (
    SELECT 
      calculate_per_diem_for_labor_actual() 
    FROM public.labor_employee_actuals
    WHERE project_id = p_project_id
      AND actual_hours > 0
  )
  SELECT COUNT(*) INTO v_total_calculated FROM recalc;
  
  -- Get total per diem amount
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_amount
  FROM public.per_diem_costs
  WHERE project_id = p_project_id;
  
  RETURN json_build_object(
    'project_id', p_project_id,
    'records_processed', v_total_calculated,
    'total_per_diem_amount', v_total_amount,
    'recalculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for per diem summary by project
CREATE OR REPLACE VIEW public.per_diem_summary AS
SELECT 
  p.id AS project_id,
  p.name AS project_name,
  p.job_number AS project_number,
  p.per_diem_enabled,
  p.per_diem_rate_direct,
  p.per_diem_rate_indirect,
  COUNT(DISTINCT pdc.employee_id) AS unique_employees,
  COUNT(DISTINCT pdc.work_date) AS days_with_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Direct' THEN pdc.amount ELSE 0 END) AS total_direct_per_diem,
  SUM(CASE WHEN pdc.employee_type = 'Indirect' THEN pdc.amount ELSE 0 END) AS total_indirect_per_diem,
  SUM(pdc.amount) AS total_per_diem_amount,
  MAX(pdc.work_date) AS last_per_diem_date,
  MIN(pdc.work_date) AS first_per_diem_date
FROM public.projects p
LEFT JOIN public.per_diem_costs pdc ON p.id = pdc.project_id
WHERE p.per_diem_enabled = true
GROUP BY p.id, p.name, p.job_number, p.per_diem_enabled, 
         p.per_diem_rate_direct, p.per_diem_rate_indirect;

-- Add RLS policies for per_diem_costs table
ALTER TABLE public.per_diem_costs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view per diem costs
CREATE POLICY "Users can view all per diem costs" ON public.per_diem_costs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only system can insert/update/delete (via triggers and functions)
CREATE POLICY "System can manage per diem costs" ON public.per_diem_costs
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Add comments for documentation
COMMENT ON COLUMN public.projects.per_diem_rate_direct IS 'Daily per diem rate for direct labor employees';
COMMENT ON COLUMN public.projects.per_diem_rate_indirect IS 'Daily per diem rate for indirect labor employees';
COMMENT ON COLUMN public.projects.per_diem_enabled IS 'Whether per diem calculation is enabled for this project';

COMMENT ON TABLE public.per_diem_costs IS 'Tracks calculated per diem costs based on labor actuals';
COMMENT ON COLUMN public.per_diem_costs.work_date IS 'The date the employee worked';
COMMENT ON COLUMN public.per_diem_costs.rate_applied IS 'The per diem rate applied for this entry';
COMMENT ON COLUMN public.per_diem_costs.days_worked IS 'Number of days worked (typically 1.00 for any hours worked)';
COMMENT ON COLUMN public.per_diem_costs.amount IS 'Calculated per diem amount (rate * days)';
COMMENT ON COLUMN public.per_diem_costs.labor_actual_id IS 'Reference to the labor actual entry that triggered this per diem';

COMMENT ON FUNCTION recalculate_project_per_diem IS 'Recalculates all per diem costs for a project based on existing labor actuals';
COMMENT ON VIEW public.per_diem_summary IS 'Summary view of per diem costs by project';