-- Create purchase order status enum
CREATE TYPE po_status AS ENUM ('draft', 'submitted', 'approved', 'cancelled', 'completed');

-- Create purchase orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id),
    po_number VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    description TEXT,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status po_status DEFAULT 'draft',
    order_date DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Import tracking fields
    legacy_po_number VARCHAR(100),
    import_batch_id VARCHAR(100),
    imported_at TIMESTAMPTZ,
    imported_by UUID REFERENCES public.profiles(id),
    
    -- Forecast fields
    forecast_amount DECIMAL(15, 2),
    forecast_date DATE,
    forecast_notes TEXT,
    
    -- Invoice tracking
    invoiced_amount DECIMAL(15, 2) DEFAULT 0,
    invoice_percentage DECIMAL(5, 2) DEFAULT 0,
    last_invoice_date DATE,
    
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    approved_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_po_number_per_project UNIQUE (project_id, po_number)
);

-- Create purchase order line items table
CREATE TABLE IF NOT EXISTS public.po_line_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_of_measure VARCHAR(50),
    unit_price DECIMAL(15, 4),
    total_amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_line_per_po UNIQUE (purchase_order_id, line_number)
);

-- Create indexes
CREATE INDEX idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_vendor ON public.purchase_orders(vendor_name);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_legacy ON public.purchase_orders(legacy_po_number) WHERE legacy_po_number IS NOT NULL;
CREATE INDEX idx_purchase_orders_import_batch ON public.purchase_orders(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX idx_purchase_orders_dates ON public.purchase_orders(order_date, expected_delivery_date);

CREATE INDEX idx_po_line_items_purchase_order ON public.po_line_items(purchase_order_id);
CREATE INDEX idx_po_line_items_category ON public.po_line_items(category) WHERE category IS NOT NULL;

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders (inherit project access)
CREATE POLICY "users_view_purchase_orders" ON public.purchase_orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = purchase_orders.project_id
        )
    );

-- Controllers and ops managers can manage purchase orders
CREATE POLICY "controllers_ops_manage_purchase_orders" ON public.purchase_orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles u
            LEFT JOIN public.projects p ON p.id = purchase_orders.project_id
            WHERE u.id = auth.uid()
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id)
            )
        )
    );

-- Project managers can create and update their project's POs
CREATE POLICY "project_managers_manage_own_pos" ON public.purchase_orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = purchase_orders.project_id
            AND projects.project_manager_id = auth.uid()
        )
    );

-- RLS Policies for po_line_items (inherit PO access)
CREATE POLICY "users_view_po_line_items" ON public.po_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders
            WHERE purchase_orders.id = po_line_items.purchase_order_id
        )
    );

CREATE POLICY "users_manage_po_line_items" ON public.po_line_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders po
            JOIN public.projects p ON p.id = po.project_id
            JOIN public.profiles u ON u.id = auth.uid()
            WHERE po.id = po_line_items.purchase_order_id
            AND (
                u.role = 'controller' OR
                (u.role = 'ops_manager' AND u.division_id = p.division_id) OR
                (u.role = 'project_manager' AND p.project_manager_id = auth.uid())
            )
        )
    );

-- Create triggers
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_line_items_updated_at
    BEFORE UPDATE ON public.po_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update PO total from line items
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.purchase_orders
    SET total_amount = (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.po_line_items
        WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
    )
    WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO total when line items change
CREATE TRIGGER update_po_total_on_line_change
    AFTER INSERT OR UPDATE OR DELETE ON public.po_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_po_total_amount();

-- Function to calculate invoice percentage
CREATE OR REPLACE FUNCTION public.update_po_invoice_percentage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_amount > 0 THEN
        NEW.invoice_percentage = (NEW.invoiced_amount / NEW.total_amount) * 100;
    ELSE
        NEW.invoice_percentage = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice percentage on INSERT
CREATE TRIGGER calculate_invoice_percentage_insert
    BEFORE INSERT ON public.purchase_orders
    FOR EACH ROW
    WHEN (NEW.invoiced_amount IS NOT NULL OR NEW.total_amount IS NOT NULL)
    EXECUTE FUNCTION public.update_po_invoice_percentage();

-- Trigger to update invoice percentage on UPDATE
CREATE TRIGGER calculate_invoice_percentage_update
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    WHEN (NEW.invoiced_amount IS DISTINCT FROM OLD.invoiced_amount OR 
          NEW.total_amount IS DISTINCT FROM OLD.total_amount)
    EXECUTE FUNCTION public.update_po_invoice_percentage();

-- Function to check PO approval limits
CREATE OR REPLACE FUNCTION public.check_po_approval_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role user_role;
    v_approval_limit DECIMAL(15, 2);
BEGIN
    -- Get approver role
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = NEW.approved_by;
    
    -- Set approval limits by role
    v_approval_limit := CASE v_user_role
        WHEN 'controller' THEN 999999999.99  -- No limit
        WHEN 'ops_manager' THEN 100000.00    -- $100k limit
        WHEN 'project_manager' THEN 25000.00 -- $25k limit
        ELSE 0
    END;
    
    -- Check if user can approve this amount
    IF NEW.total_amount > v_approval_limit THEN
        RAISE EXCEPTION 'User does not have authority to approve PO of this amount';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check approval limits
CREATE TRIGGER check_po_approval
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.approved_by IS NOT NULL)
    EXECUTE FUNCTION public.check_po_approval_limit();