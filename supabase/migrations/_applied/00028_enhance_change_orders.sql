-- Add new fields to change_orders table
ALTER TABLE public.change_orders 
ADD COLUMN IF NOT EXISTS impact_schedule_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pricing_type varchar CHECK (pricing_type IN ('LS', 'T&M', 'Estimate', 'Credit')),
ADD COLUMN IF NOT EXISTS manhours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS equipment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS material_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subcontract_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS markup_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;

-- Create co_attachments table for file uploads
CREATE TABLE IF NOT EXISTS public.co_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id),
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT co_attachments_change_order_id_fkey FOREIGN KEY (change_order_id) REFERENCES public.change_orders(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_co_attachments_change_order_id ON public.co_attachments(change_order_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_pricing_type ON public.change_orders(pricing_type);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON public.change_orders(status);

-- Add comments for documentation
COMMENT ON COLUMN public.change_orders.impact_schedule_days IS 'Number of days impact on schedule (positive for delays, negative for acceleration)';
COMMENT ON COLUMN public.change_orders.pricing_type IS 'Type of pricing: LS (Lump Sum), T&M (Time & Materials), Estimate, or Credit';
COMMENT ON COLUMN public.change_orders.manhours IS 'Estimated manhours for the change order';
COMMENT ON COLUMN public.change_orders.labor_amount IS 'Labor cost breakdown';
COMMENT ON COLUMN public.change_orders.equipment_amount IS 'Equipment cost breakdown';
COMMENT ON COLUMN public.change_orders.material_amount IS 'Material cost breakdown';
COMMENT ON COLUMN public.change_orders.subcontract_amount IS 'Subcontractor cost breakdown';
COMMENT ON COLUMN public.change_orders.markup_amount IS 'Markup/overhead amount';
COMMENT ON COLUMN public.change_orders.tax_amount IS 'Tax amount';

-- Add RLS policies for co_attachments
ALTER TABLE public.co_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments for change orders they can see
CREATE POLICY "Users can view CO attachments" ON public.co_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.change_orders co
    INNER JOIN public.projects p ON co.project_id = p.id
    INNER JOIN public.profiles prof ON prof.id = auth.uid()
    WHERE co.id = co_attachments.change_order_id
    AND (
      prof.role IN ('controller', 'executive') OR
      (prof.role = 'ops_manager' AND p.division_id = prof.division_id) OR
      (prof.role = 'project_manager' AND p.project_manager_id = prof.id) OR
      prof.role = 'accounting'
    )
  )
);

-- Policy: Users can upload attachments to change orders they can edit
CREATE POLICY "Users can upload CO attachments" ON public.co_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.change_orders co
    INNER JOIN public.projects p ON co.project_id = p.id
    INNER JOIN public.profiles prof ON prof.id = auth.uid()
    WHERE co.id = co_attachments.change_order_id
    AND (
      prof.role IN ('controller', 'ops_manager') OR
      (prof.role = 'project_manager' AND p.project_manager_id = prof.id)
    )
  )
);

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete own CO attachments" ON public.co_attachments
FOR DELETE
USING (uploaded_by = auth.uid());

-- Update existing change_orders RLS policies if needed
-- (Existing policies should already handle the table properly)

-- Create function to calculate total from breakdowns
CREATE OR REPLACE FUNCTION calculate_change_order_total()
RETURNS TRIGGER AS $$
BEGIN
  -- If breakdown amounts are provided, calculate total
  IF NEW.labor_amount IS NOT NULL OR 
     NEW.equipment_amount IS NOT NULL OR 
     NEW.material_amount IS NOT NULL OR 
     NEW.subcontract_amount IS NOT NULL OR
     NEW.markup_amount IS NOT NULL OR
     NEW.tax_amount IS NOT NULL THEN
    NEW.amount = COALESCE(NEW.labor_amount, 0) + 
                 COALESCE(NEW.equipment_amount, 0) + 
                 COALESCE(NEW.material_amount, 0) + 
                 COALESCE(NEW.subcontract_amount, 0) + 
                 COALESCE(NEW.markup_amount, 0) + 
                 COALESCE(NEW.tax_amount, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate total
CREATE TRIGGER calculate_co_total_before_insert_update
BEFORE INSERT OR UPDATE ON public.change_orders
FOR EACH ROW
EXECUTE FUNCTION calculate_change_order_total();