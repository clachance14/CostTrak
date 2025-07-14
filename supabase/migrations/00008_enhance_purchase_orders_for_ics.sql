-- Enhance purchase_orders table for ICS PO Log CSV import
-- This migration adds all the missing fields from the ICS PO system

-- Add missing fields to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS requestor VARCHAR(255),
ADD COLUMN IF NOT EXISTS sub_cost_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS contract_extra_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS cost_center VARCHAR(10),
ADD COLUMN IF NOT EXISTS sub_cc VARCHAR(10),
ADD COLUMN IF NOT EXISTS subsub_cc VARCHAR(10),
ADD COLUMN IF NOT EXISTS generation_date DATE,
ADD COLUMN IF NOT EXISTS fto_sent_date DATE,
ADD COLUMN IF NOT EXISTS fto_return_date DATE,
ADD COLUMN IF NOT EXISTS bb_date DATE,
ADD COLUMN IF NOT EXISTS wo_pmo VARCHAR(100);

-- Add missing fields to po_line_items table
ALTER TABLE public.po_line_items
ADD COLUMN IF NOT EXISTS invoice_ticket VARCHAR(100),
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS material_description TEXT,
ADD COLUMN IF NOT EXISTS contract_extra_type VARCHAR(20);

-- Create indexes for new searchable fields
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requestor ON public.purchase_orders(requestor) WHERE requestor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sub_cost_code ON public.purchase_orders(sub_cost_code) WHERE sub_cost_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_contract_extra ON public.purchase_orders(contract_extra_type) WHERE contract_extra_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cost_center ON public.purchase_orders(cost_center) WHERE cost_center IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_generation_date ON public.purchase_orders(generation_date) WHERE generation_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_line_items_invoice_ticket ON public.po_line_items(invoice_ticket) WHERE invoice_ticket IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_line_items_invoice_date ON public.po_line_items(invoice_date) WHERE invoice_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_line_items_contract_extra ON public.po_line_items(contract_extra_type) WHERE contract_extra_type IS NOT NULL;

-- Update the existing update triggers to handle new fields
-- No changes needed as they use the generic update_updated_at_column() function

-- Add constraint to ensure contract_extra_type values are valid
ALTER TABLE public.purchase_orders 
ADD CONSTRAINT check_purchase_orders_contract_extra_type 
CHECK (contract_extra_type IS NULL OR contract_extra_type IN ('Contract', 'Extra', 'Overhead'));

ALTER TABLE public.po_line_items 
ADD CONSTRAINT check_po_line_items_contract_extra_type 
CHECK (contract_extra_type IS NULL OR contract_extra_type IN ('Contract', 'Extra', 'Overhead'));

-- Comment on new fields for documentation
COMMENT ON COLUMN public.purchase_orders.requestor IS 'Person who requested the PO from ICS system';
COMMENT ON COLUMN public.purchase_orders.sub_cost_code IS 'Sub cost code from ICS system';
COMMENT ON COLUMN public.purchase_orders.contract_extra_type IS 'Classification: Contract, Extra, or Overhead';
COMMENT ON COLUMN public.purchase_orders.cost_center IS 'Cost center code from ICS system';
COMMENT ON COLUMN public.purchase_orders.sub_cc IS 'Sub cost center code from ICS system';
COMMENT ON COLUMN public.purchase_orders.subsub_cc IS 'Sub-sub cost center code from ICS system';
COMMENT ON COLUMN public.purchase_orders.generation_date IS 'Date PO was generated in ICS system';
COMMENT ON COLUMN public.purchase_orders.fto_sent_date IS 'Fabrication Transfer Order sent date';
COMMENT ON COLUMN public.purchase_orders.fto_return_date IS 'Fabrication Transfer Order return date';
COMMENT ON COLUMN public.purchase_orders.bb_date IS 'BB date from ICS system';
COMMENT ON COLUMN public.purchase_orders.wo_pmo IS 'Work Order/PMO reference from ICS system';

COMMENT ON COLUMN public.po_line_items.invoice_ticket IS 'Invoice/Ticket number from ICS system';
COMMENT ON COLUMN public.po_line_items.invoice_date IS 'Invoice date from ICS system';
COMMENT ON COLUMN public.po_line_items.material_description IS 'Material description from ICS system';
COMMENT ON COLUMN public.po_line_items.contract_extra_type IS 'Classification: Contract, Extra, or Overhead';