-- Enhanced Change Orders Implementation for CostTrak
-- This file adds all the new fields and tables needed for the comprehensive Change Order workflow

-- Step 1: Add new fields to change_orders table
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

-- Step 2: Create co_attachments table for file uploads
CREATE TABLE IF NOT EXISTS public.co_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id),
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_co_attachments_change_order_id ON public.co_attachments(change_order_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_pricing_type ON public.change_orders(pricing_type);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON public.change_orders(status);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN public.change_orders.impact_schedule_days IS 'Number of days impact on schedule (positive for delays, negative for acceleration)';
COMMENT ON COLUMN public.change_orders.pricing_type IS 'Type of pricing: LS (Lump Sum), T&M (Time & Materials), Estimate, or Credit';
COMMENT ON COLUMN public.change_orders.manhours IS 'Estimated manhours for the change order';
COMMENT ON COLUMN public.change_orders.labor_amount IS 'Labor cost breakdown';
COMMENT ON COLUMN public.change_orders.equipment_amount IS 'Equipment cost breakdown';
COMMENT ON COLUMN public.change_orders.material_amount IS 'Material cost breakdown';
COMMENT ON COLUMN public.change_orders.subcontract_amount IS 'Subcontractor cost breakdown';
COMMENT ON COLUMN public.change_orders.markup_amount IS 'Markup/overhead amount';
COMMENT ON COLUMN public.change_orders.tax_amount IS 'Tax amount';

-- Step 5: Add RLS policies for co_attachments
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

-- Step 6: Create function to calculate total from breakdowns
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

-- Step 7: Create trigger to auto-calculate total
DROP TRIGGER IF EXISTS calculate_co_total_before_insert_update ON public.change_orders;
CREATE TRIGGER calculate_co_total_before_insert_update
BEFORE INSERT OR UPDATE ON public.change_orders
FOR EACH ROW
EXECUTE FUNCTION calculate_change_order_total();

-- Step 8: Update existing change_orders with default pricing_type if null
UPDATE public.change_orders 
SET pricing_type = 'LS' 
WHERE pricing_type IS NULL;

-- Step 9: Make pricing_type required for future inserts
ALTER TABLE public.change_orders 
ALTER COLUMN pricing_type SET NOT NULL;

-- Step 10: Grant necessary permissions
GRANT ALL ON public.co_attachments TO authenticated;
GRANT ALL ON public.co_attachments TO service_role;

-- Step 11: Create storage bucket for change order attachments if it doesn't exist
-- Note: This needs to be done via Supabase Dashboard or API as SQL doesn't handle storage buckets
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('documents', 'documents', true)
-- ON CONFLICT (id) DO NOTHING;

-- Verification queries (optional - run these to check the changes):
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'change_orders' 
-- ORDER BY ordinal_position;

-- SELECT tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('change_orders', 'co_attachments');

COMMENT ON TABLE public.co_attachments IS 'Stores file attachments for change orders';
COMMENT ON COLUMN public.co_attachments.change_order_id IS 'Reference to the parent change order';
COMMENT ON COLUMN public.co_attachments.file_url IS 'URL to access the file in Supabase storage';
COMMENT ON COLUMN public.co_attachments.file_name IS 'Original file name uploaded by user';
COMMENT ON COLUMN public.co_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.co_attachments.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN public.co_attachments.uploaded_by IS 'User who uploaded the file';
COMMENT ON COLUMN public.co_attachments.uploaded_at IS 'Timestamp when file was uploaded';