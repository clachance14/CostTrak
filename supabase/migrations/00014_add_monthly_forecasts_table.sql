-- Create monthly_forecasts table for ops manager revenue tracking
CREATE TABLE IF NOT EXISTS monthly_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reporting_month VARCHAR(7) NOT NULL, -- YYYY-MM format
  percent_complete DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),
  current_month_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  next_month_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  plus_two_month_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_backlog DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  updated_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one forecast per project per month
  UNIQUE(project_id, reporting_month)
);

-- Add RLS policies
ALTER TABLE monthly_forecasts ENABLE ROW LEVEL SECURITY;

-- Policy for viewing forecasts (all authenticated users can view)
CREATE POLICY "Users can view monthly forecasts"
  ON monthly_forecasts
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for creating/updating forecasts (ops managers, executives, controllers)
CREATE POLICY "Ops managers can manage monthly forecasts"
  ON monthly_forecasts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ops_manager', 'executive', 'controller')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ops_manager', 'executive', 'controller')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_monthly_forecasts_updated_at
  BEFORE UPDATE ON monthly_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_monthly_forecasts_project_id ON monthly_forecasts(project_id);
CREATE INDEX idx_monthly_forecasts_reporting_month ON monthly_forecasts(reporting_month);
CREATE INDEX idx_monthly_forecasts_project_month ON monthly_forecasts(project_id, reporting_month);

-- Add columns to projects table for revenue tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_revenue_to_date DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS forecast_revenue_current_year DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS forecast_revenue_next_year DECIMAL(12,2) DEFAULT 0;

-- Update projects table to include actual cost fields for EAC calculations
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_cost_to_date DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_to_complete DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_final_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS profit_forecast DECIMAL(12,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS variance_at_completion DECIMAL(12,2) DEFAULT 0;

-- Update purchase_orders table to include forecasted final cost
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS forecasted_final_cost DECIMAL(12,2);

-- Create a view for project financial summary
CREATE OR REPLACE VIEW project_financial_summary AS
SELECT 
  p.id,
  p.job_number,
  p.name,
  p.status,
  p.percent_complete,
  p.original_contract_amount,
  p.revised_contract_amount,
  COALESCE(SUM(co.amount) FILTER (WHERE co.status = 'approved'), 0) as approved_change_orders,
  p.actual_cost_to_date,
  p.cost_to_complete,
  p.estimated_final_cost,
  p.profit_forecast,
  p.margin_percent,
  p.variance_at_completion,
  p.actual_revenue_to_date,
  COALESCE(SUM(po.po_value), 0) as total_committed,
  COALESCE(SUM(po.forecasted_final_cost), SUM(po.po_value), 0) as total_forecasted_cost
FROM projects p
LEFT JOIN change_orders co ON p.id = co.project_id
LEFT JOIN purchase_orders po ON p.id = po.project_id
GROUP BY p.id;

-- Grant access to the view
GRANT SELECT ON project_financial_summary TO authenticated;