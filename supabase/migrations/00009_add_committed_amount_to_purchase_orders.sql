-- Add committed_amount field to purchase_orders table
-- This will store the "Est. PO Value" from ICS imports separately from line item totals

DO $$ 
BEGIN
  -- Add committed_amount column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' 
    AND column_name = 'committed_amount' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE purchase_orders 
    ADD COLUMN committed_amount DECIMAL(15,2) DEFAULT 0.00;
    
    -- Copy existing total_amount values to committed_amount for existing records
    -- This assumes current total_amount represents the committed value
    UPDATE purchase_orders 
    SET committed_amount = total_amount 
    WHERE committed_amount = 0.00 OR committed_amount IS NULL;
    
    -- Add check constraint to ensure non-negative values
    ALTER TABLE purchase_orders 
    ADD CONSTRAINT chk_committed_amount_non_negative 
    CHECK (committed_amount >= 0);
    
    -- Add comment to document the field
    COMMENT ON COLUMN purchase_orders.committed_amount IS 'The committed PO value from ICS Est. PO Value field - represents the authorized spending amount';
    
  END IF;
END $$;