-- Add comprehensive budget line items and WBS structure tables
-- This enables detailed budget import from Excel coversheets

-- Create WBS structure table for hierarchical navigation
CREATE TABLE public.wbs_structure (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  code varchar NOT NULL,
  parent_code varchar,
  level integer NOT NULL,
  description text,
  budget_total numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wbs_structure_pkey PRIMARY KEY (id),
  CONSTRAINT wbs_structure_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT wbs_structure_unique_code UNIQUE (project_id, code)
);

-- Create master table for all budget line items from Excel sheets
CREATE TABLE public.budget_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  
  -- Source tracking
  source_sheet varchar NOT NULL,
  source_row integer,
  import_batch_id uuid NOT NULL,
  
  -- WBS and categorization
  wbs_code varchar,
  wbs_level1 varchar, -- Division (01, 02, etc.)
  wbs_level2 varchar, -- Category (100, 200, etc.)
  wbs_level3 varchar, -- Item (001, 002, etc.)
  discipline varchar,
  category varchar CHECK (category IN ('LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER')),
  subcategory varchar, -- DIRECT, INDIRECT, STAFF for labor
  
  -- Item details
  line_number varchar,
  description text NOT NULL,
  
  -- Quantities and rates
  quantity numeric,
  unit_of_measure varchar,
  unit_rate numeric,
  
  -- Hours (for labor items)
  manhours numeric,
  crew_size integer,
  duration_days numeric,
  
  -- Cost breakdown
  labor_cost numeric DEFAULT 0,
  material_cost numeric DEFAULT 0,
  equipment_cost numeric DEFAULT 0,
  subcontract_cost numeric DEFAULT 0,
  other_cost numeric DEFAULT 0,
  total_cost numeric NOT NULL,
  
  -- Additional metadata
  notes text,
  contractor_name varchar, -- For subcontracts
  supplier_name varchar,   -- For materials
  owned_or_rented varchar CHECK (owned_or_rented IN ('OWNED', 'RENTED')), -- For equipment
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT budget_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT budget_line_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Create sheet mapping configuration table
CREATE TABLE public.excel_sheet_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_name varchar NOT NULL UNIQUE,
  category varchar NOT NULL,
  subcategory varchar,
  column_mappings jsonb NOT NULL,
  parsing_rules jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT excel_sheet_mappings_pkey PRIMARY KEY (id)
);

-- Create indexes for performance
CREATE INDEX idx_budget_line_items_project ON public.budget_line_items(project_id);
CREATE INDEX idx_budget_line_items_wbs ON public.budget_line_items(wbs_code);
CREATE INDEX idx_budget_line_items_category ON public.budget_line_items(category);
CREATE INDEX idx_budget_line_items_source ON public.budget_line_items(source_sheet);
CREATE INDEX idx_budget_line_items_batch ON public.budget_line_items(import_batch_id);

CREATE INDEX idx_wbs_structure_project ON public.wbs_structure(project_id);
CREATE INDEX idx_wbs_structure_code ON public.wbs_structure(code);
CREATE INDEX idx_wbs_structure_parent ON public.wbs_structure(parent_code);

-- Add triggers for updated_at
CREATE TRIGGER update_budget_line_items_updated_at
  BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wbs_structure_updated_at
  BEFORE UPDATE ON public.wbs_structure
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for budget rollups by WBS
CREATE VIEW public.budget_wbs_rollup AS
SELECT 
  bli.project_id,
  bli.wbs_code,
  ws.description as wbs_description,
  ws.level as wbs_level,
  ws.parent_code,
  COUNT(*) as line_item_count,
  SUM(bli.total_cost) as total_budget,
  SUM(bli.labor_cost) as labor_budget,
  SUM(bli.material_cost) as material_budget,
  SUM(bli.equipment_cost) as equipment_budget,
  SUM(bli.subcontract_cost) as subcontract_budget,
  SUM(bli.other_cost) as other_budget,
  SUM(bli.manhours) as total_manhours,
  STRING_AGG(DISTINCT bli.source_sheet, ', ') as source_sheets
FROM public.budget_line_items bli
LEFT JOIN public.wbs_structure ws ON bli.project_id = ws.project_id AND bli.wbs_code = ws.code
GROUP BY bli.project_id, bli.wbs_code, ws.description, ws.level, ws.parent_code;

-- Create view for budget rollups by category
CREATE VIEW public.budget_category_rollup AS
SELECT 
  project_id,
  category,
  subcategory,
  COUNT(*) as line_item_count,
  SUM(total_cost) as total_budget,
  SUM(manhours) as total_manhours,
  STRING_AGG(DISTINCT source_sheet, ', ') as source_sheets
FROM public.budget_line_items
GROUP BY project_id, category, subcategory;

-- Insert default sheet mappings
INSERT INTO public.excel_sheet_mappings (sheet_name, category, subcategory, column_mappings) VALUES
('BUDGETS', 'SUMMARY', NULL, '{"discipline": 1, "wbs_code": 2, "description": 3, "manhours": 4, "value": 5}'::jsonb),
('DIRECTS', 'LABOR', 'DIRECT', '{"wbs_code": 0, "description": 1, "crew_size": 2, "duration": 3, "manhours": 4, "rate": 5, "total_cost": 6}'::jsonb),
('INDIRECTS', 'LABOR', 'INDIRECT', '{"wbs_code": 0, "description": 1, "quantity": 2, "duration": 3, "rate": 4, "total_cost": 5}'::jsonb),
('STAFF', 'LABOR', 'STAFF', '{"wbs_code": 0, "position": 1, "quantity": 2, "duration": 3, "monthly_rate": 4, "total_cost": 5}'::jsonb),
('MATERIALS', 'MATERIAL', NULL, '{"wbs_code": 0, "description": 1, "quantity": 2, "unit": 3, "unit_price": 4, "total_cost": 5, "supplier": 6}'::jsonb),
('GENERAL EQUIPMENT', 'EQUIPMENT', NULL, '{"wbs_code": 0, "description": 1, "quantity": 2, "duration": 3, "rate": 4, "total_cost": 5, "owned_rented": 6}'::jsonb),
('SUBS', 'SUBCONTRACT', NULL, '{"wbs_code": 0, "description": 1, "contractor": 2, "lump_sum": 3, "unit_price": 4, "total_cost": 5}'::jsonb),
('CONSTRUCTABILITY', 'OTHER', 'RISK', '{"wbs_code": 0, "description": 1, "mitigation": 2, "cost_impact": 3, "total_cost": 4}'::jsonb);

-- Add RLS policies
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_sheet_mappings ENABLE ROW LEVEL SECURITY;

-- Budget line items follow project access rules
CREATE POLICY "Users can view budget items for accessible projects" ON public.budget_line_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = budget_line_items.project_id
      AND (
        -- Controllers can see all
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'controller')
        -- Project managers can see their projects
        OR p.project_manager_id = auth.uid()
        -- Ops managers can see their division's projects
        OR EXISTS (
          SELECT 1 FROM public.profiles prof
          WHERE prof.id = auth.uid()
          AND prof.role = 'ops_manager'
          AND p.division_id = prof.division_id
        )
      )
    )
  );

-- Controllers can manage budget items
CREATE POLICY "Controllers can manage budget items" ON public.budget_line_items
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

-- Similar policies for WBS structure
CREATE POLICY "Users can view WBS for accessible projects" ON public.wbs_structure
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = wbs_structure.project_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'controller')
        OR p.project_manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles prof
          WHERE prof.id = auth.uid()
          AND prof.role = 'ops_manager'
          AND p.division_id = prof.division_id
        )
      )
    )
  );

CREATE POLICY "Controllers can manage WBS" ON public.wbs_structure
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

-- All authenticated users can view sheet mappings
CREATE POLICY "All users can view sheet mappings" ON public.excel_sheet_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only controllers can manage sheet mappings
CREATE POLICY "Controllers can manage sheet mappings" ON public.excel_sheet_mappings
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

-- Add comments
COMMENT ON TABLE public.budget_line_items IS 'Detailed budget line items imported from Excel coversheet files';
COMMENT ON TABLE public.wbs_structure IS 'Work Breakdown Structure hierarchy for organizing budget items';
COMMENT ON TABLE public.excel_sheet_mappings IS 'Configuration for mapping Excel sheet columns to database fields';
COMMENT ON VIEW public.budget_wbs_rollup IS 'Aggregated budget data grouped by WBS code';
COMMENT ON VIEW public.budget_category_rollup IS 'Aggregated budget data grouped by category';