# Per Diem Cost Backfill Instructions

## Overview
The per diem feature has been implemented with a "Winner Takes All" approach to ensure employees receive only ONE per diem per day, even when working multiple projects. This document explains how to properly capture per diem costs in your project financials.

## Per Diem Rules
- **Rate**: $120/day for ALL employees (Direct and Indirect)
- **Eligible Projects**: 5867, 5639, 5640, 5614, 5601, 5800, 5730, 5772
- **One Per Day Rule**: Each employee gets maximum one per diem per day
- **Allocation**: When working multiple projects, the project with most hours gets the per diem

## What's Been Done

### 1. Database Structure
- Per diem tables and triggers are already in place (`per_diem_costs` table)
- Projects have per diem configuration fields (`per_diem_enabled`, `per_diem_rate_direct`, `per_diem_rate_indirect`)

### 2. API Updates
Updated the following APIs to include per diem costs in labor calculations:
- `/api/projects/[id]/budget-vs-actual` - Now includes per diem in labor actuals
- `/api/projects/[id]/overview` - Now includes per diem in total labor costs

### 3. Scripts Created
- `scripts/analyze-perdiem-costs.ts` - Analyzes current per diem data
- `scripts/backfill-perdiem-costs.ts` - Backfills per diem for existing labor data
- `scripts/backfill-perdiem-migration.sql` - SQL migration for database views

## Steps to Backfill Per Diem Costs

### Step 1: Apply the Winner Takes All Fix
This is the RECOMMENDED approach that ensures one per diem per employee per day:

```sql
-- Run in Supabase SQL Editor
-- Copy contents of: scripts/fix-perdiem-winner-takes-all.sql
```

This script will:
1. Set per diem to $120/day for all employees
2. Enable per diem only for projects: 5867, 5639, 5640, 5614, 5601, 5800, 5730, 5772
3. Clear incorrect data
4. Recalculate with "Winner Takes All" logic
5. Verify the results

### Step 2: Check for Conflicts (Optional)
To see which employees work multiple projects on the same day:

```sql
-- Run: scripts/check-perdiem-conflicts.sql
```

### Step 3: Analyze Current State
Check which projects need per diem backfill:

```bash
pnpm tsx scripts/analyze-perdiem-costs.ts
```

This will show:
- Projects with per diem enabled
- Current per diem costs calculated
- Projects that need backfilling

### Step 4: Run the Backfill
Execute the backfill script to calculate per diem for all existing labor data:

```bash
pnpm tsx scripts/backfill-perdiem-costs.ts
```

This will:
- Process all projects with per diem enabled
- Calculate per diem for each day an employee worked
- Store the costs in the `per_diem_costs` table

### Step 5: Apply Database Views (Optional)
For better reporting, apply the enhanced views:

```bash
# Run in Supabase SQL Editor
cat scripts/backfill-perdiem-migration.sql
```

This creates views that automatically include per diem in cost calculations.

### Step 6: Verify the Results
After backfilling, verify the costs are correct:

```bash
pnpm tsx scripts/analyze-perdiem-costs.ts
```

Check the dashboard to ensure per diem is now included in:
- Budget vs Actual reports
- Project Overview page
- Labor Analytics

## How Per Diem Works

### Calculation Logic - "Winner Takes All"
- Per diem is calculated when labor actuals are imported
- One per diem ($120) per employee per day, regardless of hours worked
- When an employee works multiple projects on the same day:
  - The project with the MOST hours gets the full $120 per diem
  - Other projects get $0 for that employee that day
  - Tiebreaker: Lower job number wins
- Costs are stored separately but included in total labor costs

### Automatic Triggers
The database has triggers that automatically calculate per diem when:
- New labor actuals are imported
- Existing labor records are updated
- Per diem rates are changed for a project

### Manual Recalculation
To recalculate per diem for a specific project:

```sql
SELECT recalculate_project_per_diem('PROJECT_ID_HERE');
```

## Troubleshooting

### Per Diem Not Showing
1. Check if per diem is enabled for the project
2. Verify rates are set (not zero)
3. Ensure labor actuals exist for the project
4. Run the backfill script

### Incorrect Amounts
1. Verify the daily rates are correct
2. Check employee classifications (Direct/Indirect)
3. Recalculate using the SQL function

### API Not Showing Per Diem
The APIs have been updated, but ensure:
1. You've restarted the development server
2. Clear any cached data
3. Check browser console for errors

## Important Notes

- Per diem is added ON TOP of burdened labor costs
- Per diem is calculated per calendar day, not per hours worked
- The system uses employee classification from the `employees` table
- Per diem costs are auditable via the `per_diem_costs` table

## Next Steps

After backfilling:
1. Review total labor costs on each project
2. Verify budget vs actual reports are accurate
3. Update any custom reports to include per diem
4. Consider updating forecasting logic to project future per diem costs