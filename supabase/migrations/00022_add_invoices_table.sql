-- Add invoices table for tracking project billing and cash flow
-- This enables accurate financial reporting and invoice tracking

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  purchase_order_id uuid,
  invoice_number varchar NOT NULL,
  invoice_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  payment_date date,
  payment_terms varchar,
  due_date date,
  notes text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT invoices_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT invoices_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
);

-- Create indexes for performance
CREATE INDEX idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX idx_invoices_purchase_order_id ON public.invoices(purchase_order_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
CREATE UNIQUE INDEX idx_invoices_number_project ON public.invoices(invoice_number, project_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Controllers and accounting can see all invoices
CREATE POLICY "Controllers and accounting can view all invoices" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('controller', 'accounting')
    )
  );

-- Project managers can see invoices for their projects
CREATE POLICY "Project managers can view their project invoices" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = invoices.project_id
      AND projects.project_manager_id = auth.uid()
    )
  );

-- Ops managers can see invoices for their division
CREATE POLICY "Ops managers can view division invoices" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.profiles prof ON prof.id = auth.uid()
      WHERE p.id = invoices.project_id
      AND p.division_id = prof.division_id
      AND prof.role = 'ops_manager'
    )
  );

-- Controllers and accounting can create invoices
CREATE POLICY "Controllers and accounting can create invoices" ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('controller', 'accounting')
    )
  );

-- Controllers and accounting can update invoices
CREATE POLICY "Controllers and accounting can update invoices" ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('controller', 'accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('controller', 'accounting')
    )
  );

-- Add audit logging for invoice changes
CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_log (
        entity_type,
        entity_id,
        action,
        changes,
        performed_by
      ) VALUES (
        'invoice',
        NEW.id,
        'status_change',
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'invoice_number', NEW.invoice_number,
          'amount', NEW.amount
        ),
        auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER invoice_audit_trigger
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_changes();

-- Add comment
COMMENT ON TABLE public.invoices IS 'Tracks all project invoices for billing and cash flow management';