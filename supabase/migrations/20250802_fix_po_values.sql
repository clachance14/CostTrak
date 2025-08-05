-- Fix PO values migration
-- This migration ensures po_value contains the original PO value from import
-- and total_amount reflects the invoiced amount

-- Update po_value where it's null or 0, copying from committed_amount
UPDATE purchase_orders 
SET po_value = committed_amount 
WHERE (po_value IS NULL OR po_value = 0) 
AND committed_amount IS NOT NULL;

-- Update total_amount to match invoiced_amount
UPDATE purchase_orders 
SET total_amount = invoiced_amount 
WHERE invoiced_amount IS NOT NULL;

-- For POs without invoices, set total_amount to 0
UPDATE purchase_orders 
SET total_amount = 0 
WHERE invoiced_amount IS NULL OR invoiced_amount = 0;

-- Add comment to clarify field purposes
COMMENT ON COLUMN purchase_orders.po_value IS 'Original PO value from import (immutable)';
COMMENT ON COLUMN purchase_orders.committed_amount IS 'Forecasted/committed value for cost tracking (editable)';
COMMENT ON COLUMN purchase_orders.total_amount IS 'Total amount invoiced by vendor';
COMMENT ON COLUMN purchase_orders.invoiced_amount IS 'Calculated sum of invoice line items';