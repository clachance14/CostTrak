# APPLY THIS PER DIEM FIX NOW

## Quick Summary
Your per diem costs are currently **way too high** because employees are getting multiple per diems when working on multiple projects the same day.

### Current Issue
- Employees working 2 projects = getting 2 per diems ($240/day instead of $120)
- Total costs are inflated by 2-5x the correct amount

## The Fix: Winner Takes All

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy the entire contents of:
scripts/fix-perdiem-winner-takes-all.sql
```

## What This Does

1. **Sets correct rate**: $120/day for everyone (not $200/$175)
2. **Enables only for correct projects**: 5867, 5639, 5640, 5614, 5601, 5800, 5730, 5772
3. **Implements "Winner Takes All"**: 
   - Each employee gets ONE per diem per day maximum
   - Goes to the project where they worked most hours
   - Prevents double/triple dipping

## Expected Results

### Before (WRONG):
- Project 5640: $1,172,250 ❌
- Project 5730: $221,875 ❌  
- Project 5790: $62,625 ❌

### After (CORRECT):
- Project 5640: ~$200,000 ✅ (much more reasonable)
- Project 5730: ~$50,000 ✅
- Project 5790: ~$10,000 ✅

## Verification

After running the fix, the script automatically shows:
1. ✅ No employee has multiple per diems on same day
2. ✅ All per diems are exactly $120
3. ✅ Total = (unique employee-days) × $120

## Why This Works

Instead of creating new tables or complex constraints, we use smart allocation:
- SQL finds all employee-day combinations
- For each, determines which project "wins" (most hours)
- Creates only ONE per diem record per employee-day
- Natural enforcement of the business rule

## Next Steps

1. **Run the fix** (scripts/fix-perdiem-winner-takes-all.sql)
2. **Verify results** match expectations
3. **Check conflicts** if needed (scripts/check-perdiem-conflicts.sql)
4. Per diem will now be correctly included in all financial reports