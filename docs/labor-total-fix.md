# Fix for Labor Total Calculation

## Problem
The Labor total was showing as 73.6% of the budget ($465,995 out of $633,419), which was too high. The issue was that the labor calculation included ALL categories that weren't materials, equipment, or subcontractors, which incorrectly included:
- SMALL TOOLS & CONSUMABLES
- RISK

## Solution
Updated the BudgetsSheetParser to calculate labor total correctly by only including labor-related categories:

### Labor Categories (included in Labor total):
- DIRECT LABOR
- INDIRECT LABOR
- TAXES & INSURANCE
- PERDIEM
- ADD ONS

### Other Categories (not included in Labor total):
- SMALL TOOLS & CONSUMABLES
- RISK

## Changes Made

1. **BudgetsSheetParser.ts**:
   - Changed from calculating labor as "everything except materials, equipment, and subcontractors"
   - Now explicitly sums only the labor-related categories
   - Other costs (SMALL TOOLS & CONSUMABLES, RISK) are excluded from labor total

2. **ExcelBudgetAnalyzerV2.ts**:
   - Updated to calculate "other" costs as the difference between grand total and all main categories
   - Updated category mapping to ensure TAXES_INSURANCE, PERDIEM, and ADD_ONS are categorized as LABOR

## Expected Result
With this fix, the Labor total should now show a more reasonable percentage of the total budget, with:
- Subcontractors showing their actual value (not $0)
- Labor showing only actual labor-related costs
- Other costs properly categorized

## Testing
When you upload the Excel file again, you should see:
- Labor percentage reduced from 73.6% to a more reasonable value
- Subcontracts showing actual values if present
- Total budget remaining the same ($633,419)