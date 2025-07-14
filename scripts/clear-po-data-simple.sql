-- Simple script to clear all Purchase Order and Line Item data
-- This version avoids sequence reset issues

-- Clear line items first (due to foreign key constraints)
DELETE FROM po_line_items;

-- Clear purchase orders
DELETE FROM purchase_orders;

-- Verify deletion (should show 0 for both)
SELECT 
    'purchase_orders' as table_name, 
    COUNT(*) as remaining_records 
FROM purchase_orders
UNION ALL
SELECT 
    'po_line_items' as table_name, 
    COUNT(*) as remaining_records 
FROM po_line_items;

-- Show completion message
SELECT 'Data clearing completed successfully' as status;