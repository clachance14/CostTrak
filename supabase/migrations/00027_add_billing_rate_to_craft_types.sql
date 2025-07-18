-- Add billing_rate column to craft_types table
-- This column will store the billing rate for each craft type (used for T&M billing)
-- while the actual labor costs will be calculated using employee base_rate

ALTER TABLE public.craft_types
ADD COLUMN billing_rate numeric DEFAULT NULL;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN public.craft_types.billing_rate IS 'Billing rate per hour for this craft type (used for T&M and change orders). Actual labor costs are calculated using employee base_rate.';

-- Optionally set some default billing rates for existing craft types
-- These can be adjusted later through the UI or API
UPDATE public.craft_types
SET billing_rate = CASE
    WHEN code = 'DIRECT' THEN 85.00
    WHEN code = '01-100' THEN 85.00
    WHEN category = 'direct' THEN 85.00
    WHEN category = 'indirect' THEN 75.00
    WHEN category = 'staff' THEN 95.00
    ELSE NULL
END
WHERE billing_rate IS NULL;