-- Delete script for project with job_number '5640'
-- This script will delete the project and ALL associated data
-- WARNING: This is a HARD DELETE and cannot be undone!

BEGIN;

-- Get the project ID for job_number 5640
DO $$
DECLARE
    v_project_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Find the project
    SELECT id INTO v_project_id 
    FROM projects 
    WHERE job_number = '5640';
    
    IF v_project_id IS NULL THEN
        RAISE NOTICE 'Project with job_number 5640 not found';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found project ID: %', v_project_id;
    
    -- Delete from labor_headcount_forecasts
    DELETE FROM labor_headcount_forecasts WHERE project_id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % labor_headcount_forecasts records', v_deleted_count;
    
    -- Delete from labor_employee_actuals
    DELETE FROM labor_employee_actuals WHERE project_id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % labor_employee_actuals records', v_deleted_count;
    
    -- Delete from po_line_items (must be before purchase_orders)
    DELETE FROM po_line_items 
    WHERE purchase_order_id IN (
        SELECT id FROM purchase_orders WHERE project_id = v_project_id
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % po_line_items records', v_deleted_count;
    
    -- Delete from purchase_orders
    DELETE FROM purchase_orders WHERE project_id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % purchase_orders records', v_deleted_count;
    
    -- Delete from change_orders
    DELETE FROM change_orders WHERE project_id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % change_orders records', v_deleted_count;
    
    -- Delete from budget_line_items
    DELETE FROM budget_line_items WHERE project_id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % budget_line_items records', v_deleted_count;
    
    -- Delete from data_imports
    DELETE FROM data_imports WHERE project_id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % data_imports records', v_deleted_count;
    
    -- Delete from audit_log entries related to this project
    DELETE FROM audit_log 
    WHERE entity_type = 'project' AND entity_id = v_project_id
       OR entity_type IN ('purchase_order', 'change_order', 'budget_line_item')
          AND entity_id IN (
              SELECT id FROM purchase_orders WHERE project_id = v_project_id
              UNION ALL
              SELECT id FROM change_orders WHERE project_id = v_project_id
              UNION ALL
              SELECT id FROM budget_line_items WHERE project_id = v_project_id
          );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % audit_log records', v_deleted_count;
    
    -- Finally, delete the project itself
    DELETE FROM projects WHERE id = v_project_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % project record(s)', v_deleted_count;
    
    RAISE NOTICE 'Successfully deleted project 5640 and all associated data';
END $$;

-- Commit the transaction to make changes permanent
-- Change to ROLLBACK if you want to test without actually deleting
COMMIT;

-- Verify deletion
SELECT 
    'Project still exists' as status,
    id, 
    name, 
    job_number 
FROM projects 
WHERE job_number = '5640';