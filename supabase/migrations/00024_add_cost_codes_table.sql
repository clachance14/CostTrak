-- Add cost codes table for consistent categorization across labor and POs
-- This enables accurate rollups and discipline-based reporting

CREATE TABLE public.cost_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  description text NOT NULL,
  discipline varchar NOT NULL,
  category varchar CHECK (category IN ('labor', 'material', 'equipment', 'subcontract', 'other')),
  parent_code_id uuid,
  is_active boolean DEFAULT true,
  sort_order integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cost_codes_pkey PRIMARY KEY (id),
  CONSTRAINT cost_codes_parent_code_id_fkey FOREIGN KEY (parent_code_id) REFERENCES public.cost_codes(id)
);

-- Create indexes
CREATE INDEX idx_cost_codes_code ON public.cost_codes(code);
CREATE INDEX idx_cost_codes_discipline ON public.cost_codes(discipline);
CREATE INDEX idx_cost_codes_category ON public.cost_codes(category);
CREATE INDEX idx_cost_codes_parent ON public.cost_codes(parent_code_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_cost_codes_updated_at
  BEFORE UPDATE ON public.cost_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add cost_code_id to relevant tables
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS cost_code_id uuid REFERENCES public.cost_codes(id);

ALTER TABLE public.labor_actuals 
ADD COLUMN IF NOT EXISTS cost_code_id uuid REFERENCES public.cost_codes(id);

ALTER TABLE public.project_budget_breakdowns 
ADD COLUMN IF NOT EXISTS cost_code_id uuid REFERENCES public.cost_codes(id);

-- Create indexes for the new foreign keys
CREATE INDEX idx_purchase_orders_cost_code ON public.purchase_orders(cost_code_id);
CREATE INDEX idx_labor_actuals_cost_code ON public.labor_actuals(cost_code_id);
CREATE INDEX idx_project_budget_breakdowns_cost_code ON public.project_budget_breakdowns(cost_code_id);

-- Add RLS policies
ALTER TABLE public.cost_codes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active cost codes
CREATE POLICY "Authenticated users can view active cost codes" ON public.cost_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Controllers can manage cost codes
CREATE POLICY "Controllers can manage cost codes" ON public.cost_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'controller'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'controller'
    )
  );

-- Insert some default cost codes
INSERT INTO public.cost_codes (code, description, discipline, category, sort_order) VALUES
-- Labor codes
('01-100', 'Direct Labor - General', 'General', 'labor', 100),
('01-200', 'Direct Labor - Electrical', 'Electrical', 'labor', 200),
('01-300', 'Direct Labor - Mechanical', 'Mechanical', 'labor', 300),
('01-400', 'Direct Labor - Piping', 'Piping', 'labor', 400),
('01-500', 'Direct Labor - Civil', 'Civil', 'labor', 500),
('01-600', 'Indirect Labor', 'General', 'labor', 600),
('01-700', 'Staff Labor', 'General', 'labor', 700),

-- Material codes
('02-100', 'Materials - General', 'General', 'material', 1100),
('02-200', 'Materials - Electrical', 'Electrical', 'material', 1200),
('02-300', 'Materials - Mechanical', 'Mechanical', 'material', 1300),
('02-400', 'Materials - Piping', 'Piping', 'material', 1400),

-- Equipment codes
('03-100', 'Equipment - Small Tools', 'General', 'equipment', 2100),
('03-200', 'Equipment - Heavy Equipment', 'General', 'equipment', 2200),
('03-300', 'Equipment - Rental', 'General', 'equipment', 2300),

-- Subcontract codes
('04-100', 'Subcontract - General', 'General', 'subcontract', 3100),
('04-200', 'Subcontract - Specialty', 'General', 'subcontract', 3200),

-- Other codes
('05-100', 'Other - Permits & Fees', 'General', 'other', 4100),
('05-200', 'Other - Insurance', 'General', 'other', 4200),
('05-300', 'Other - Contingency', 'General', 'other', 4300)
ON CONFLICT (code) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.cost_codes IS 'Master list of cost codes for categorizing labor, materials, and other project costs';