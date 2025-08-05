# Labor Forecast Historical Values Fix

## Issue Summary
The labor forecast tab was showing $0.00/hr for the composite rate despite indicating "16 weeks of data" existed. All historical values were missing from the display.

## Root Cause
The database functions (`get_composite_labor_rate`, `get_labor_category_rates`, etc.) were filtering employee categories using lowercase values ('direct', 'indirect', 'staff'), but the actual data in the `employees` table uses capitalized values ('Direct', 'Indirect', 'Staff').

### Evidence
- Total labor records in database: 363
- Manual calculation shows composite rate: $49.97/hr
- Database function returns: $0.00/hr
- Employee categories in database: 'Direct', 'Indirect', 'Staff' (capitalized)

## Solution

### Immediate Fix (Database Migration)
Apply the migration file: `supabase/migrations/20250805_fix_category_case_sensitivity.sql`

This migration:
1. Updates all labor forecast functions to handle capitalized category names
2. Converts categories to lowercase in API responses for consistency
3. Creates missing database indexes for performance

### How to Apply the Fix

1. **Via Supabase Dashboard (Recommended)**
   - Go to: https://supabase.com/dashboard/project/gzrxhwpmtbgnngadgnse/sql/new
   - Copy the contents of: `supabase/migrations/20250805_fix_category_case_sensitivity.sql`
   - Paste into the SQL editor
   - Click "Run" to execute

2. **Verify the Fix**
   ```bash
   npx tsx scripts/test-labor-forecast-api-direct.ts
   ```
   After applying, the function should return the correct composite rate.

### Enhanced Logging Added
Debug logging has been added to the labor forecast tab component to help diagnose issues:
- Composite rate API responses
- Display values in the UI
- Weekly actuals data

Look for `[DEBUG]` prefixed messages in the browser console.

## Testing
After applying the fix:
1. Navigate to a project's labor forecast tab
2. Check the browser console for debug logs
3. Verify the composite rate shows the correct value (not $0.00)
4. Confirm historical data is visible in the weekly breakdown

## Additional Notes
- The issue affected all labor forecast calculations that rely on employee categories
- No data was lost; it was simply not being queried correctly
- The fix maintains backward compatibility by converting to lowercase in API responses