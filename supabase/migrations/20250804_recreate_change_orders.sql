-- Nuclear option: Recreate change_orders table to remove all legacy references

-- 1. Create a backup of existing data
CREATE TABLE change_orders_backup AS SELECT * FROM change_orders;

-- 2. Drop the existing table (this will remove ALL triggers, policies, etc.)
DROP TABLE change_orders CASCADE;

-- 3. Recreate the table with a clean structure
CREATE TABLE change_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    co_number varchar(50) NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    pricing_type text DEFAULT 'LS' CHECK (pricing_type IN ('LS', 'T&M', 'Estimate', 'Credit')),
    
    -- Cost breakdown
    labor_amount numeric(12,2) DEFAULT 0,
    manhours numeric(10,2) DEFAULT 0,
    equipment_amount numeric(12,2) DEFAULT 0,
    material_amount numeric(12,2) DEFAULT 0,
    subcontract_amount numeric(12,2) DEFAULT 0,
    markup_amount numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    
    -- Schedule
    impact_schedule_days integer DEFAULT 0,
    
    -- Dates
    submitted_date timestamptz,
    approved_date timestamptz,
    
    -- User tracking
    created_by uuid REFERENCES profiles(id),
    approved_by uuid REFERENCES profiles(id),
    
    -- Soft delete
    deleted_at timestamptz,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Deprecated division field (nullable, no FK)
    division_id uuid,
    
    -- Other optional fields
    reason text,
    rejection_reason text,
    
    -- Unique constraint
    UNIQUE(project_id, co_number)
);

-- 4. Create indexes
CREATE INDEX idx_change_orders_project_id ON change_orders(project_id);
CREATE INDEX idx_change_orders_status ON change_orders(status);
CREATE INDEX idx_change_orders_created_at ON change_orders(created_at);

-- 5. Enable RLS
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

-- 6. Create simple RLS policy
CREATE POLICY "change_orders_authenticated_access" ON change_orders
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Restore data from backup
INSERT INTO change_orders SELECT * FROM change_orders_backup;

-- 8. Drop the backup table
DROP TABLE change_orders_backup;

-- 9. Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_change_orders_updated_at 
    BEFORE UPDATE ON change_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();