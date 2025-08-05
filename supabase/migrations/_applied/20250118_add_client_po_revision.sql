-- Add client_po_revision field to project_contract_breakdowns table
ALTER TABLE project_contract_breakdowns 
ADD COLUMN client_po_revision VARCHAR;

-- Add comment for documentation
COMMENT ON COLUMN project_contract_breakdowns.client_po_revision IS 'Client PO revision number or letter (e.g., Rev A, Rev 1, etc.)';