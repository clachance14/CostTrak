-- Script to clear all Purchase Order and Line Item data
-- Run this before re-importing the CSV file

-- Clear line items first (due to foreign key constraints)
DELETE FROM po_line_items;

-- Clear purchase orders
DELETE FROM purchase_orders;

-- Reset sequences for clean IDs (optional - only if sequences exist)
-- Note: Sequence names may vary depending on PostgreSQL setup
DO $$ 
BEGIN
    -- Try to reset po_line_items sequence
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'po_line_items_id_seq') THEN
        PERFORM setval('po_line_items_id_seq', 1, false);
    END IF;
    
    -- Try to reset purchase_orders sequence  
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'purchase_orders_id_seq') THEN
        PERFORM setval('purchase_orders_id_seq', 1, false);
    END IF;
END $$;

-- Verify deletion
SELECT 
    'purchase_orders' as table_name, 
    COUNT(*) as remaining_records 
FROM purchase_orders
UNION ALL
SELECT 
    'po_line_items' as table_name, 
    COUNT(*) as remaining_records 
FROM po_line_items;