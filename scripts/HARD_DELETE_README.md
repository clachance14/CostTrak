# Hard Delete Project Documentation

## Overview

The hard delete functionality completely removes a project and all its related data from the CostTrak database. This is a destructive operation that cannot be undone.

## Scripts

### 1. `hard-delete-project-comprehensive.ts` (Recommended)
The most complete version that handles all tables including new multi-division support.

**Usage:**
```bash
# Dry run - shows what would be deleted without actually deleting
npx tsx scripts/hard-delete-project-comprehensive.ts <job_number> --dry-run

# Actual deletion - requires --force flag
npx tsx scripts/hard-delete-project-comprehensive.ts <job_number> --force
```

### 2. `hard-delete-project-force.ts` (Legacy)
Older version that doesn't include all new tables.

### 3. `hard-delete-project.ts` (Legacy)
Original version with interactive confirmation.

## Data Deletion Scope

The comprehensive script deletes data from the following 23 tables:

### Core Project Data
- `projects` - Main project record
- `project_divisions` - Project-division associations
- `user_project_access` - User access permissions

### Financial Data
- `project_budgets` - Budget information
- `project_budget_breakdowns` - Detailed budget breakdowns
- `project_contract_breakdowns` - Contract breakdowns
- `division_budgets` - Division-specific budgets
- `division_forecasts` - Division-specific forecasts
- `financial_snapshots` - Pre-calculated metrics
- `monthly_forecasts` - Monthly forecast data

### Purchase Orders
- `purchase_orders` - Main PO records
- `po_line_items` - PO line items (via PO relationship)
- `project_po_line_items` - Project-specific PO items

### Change Orders
- `change_orders` - Change order records
- `co_attachments` - File attachments (also deletes files from storage)

### Labor Data
- `labor_actuals` - Weekly actual costs
- `labor_employee_actuals` - Employee-specific actuals
- `labor_headcount_forecasts` - Headcount projections
- `labor_running_averages` - Running average calculations

### Other Data
- `invoices` - Invoice records
- `data_imports` - Import tracking
- `audit_log` - Audit trail entries
- `notification_triggers` - Notification settings

### File Storage
- Deletes associated files from Supabase storage buckets (e.g., CO attachments)

## Deletion Order

The script follows a specific order to respect foreign key constraints:

1. Labor data (employee actuals → actuals → forecasts → averages)
2. Attachments and files
3. Change orders
4. PO line items → Purchase orders
5. Project PO line items
6. Invoices
7. Division forecasts → Division budgets → Project divisions
8. Financial snapshots
9. Budget and contract data
10. Monthly forecasts
11. Import tracking and audit logs
12. Notification triggers
13. User access records
14. Finally, the project itself

## Safety Features

1. **Dry Run Mode**: Use `--dry-run` to preview what would be deleted
2. **Force Flag Required**: Must use `--force` to actually delete data
3. **Comprehensive Summary**: Shows exact record counts before deletion
4. **Verification**: Confirms project is deleted after operation
5. **Error Handling**: Continues deletion even if individual steps fail

## Warning

⚠️ **This operation is permanent and cannot be undone!**

Before using:
1. Always run with `--dry-run` first
2. Verify the correct job number
3. Consider backing up the project data first
4. Ensure you have the necessary permissions

## Requirements

- Admin access (uses service role key)
- Environment variables properly configured
- Node.js and TypeScript installed

## Example Workflow

```bash
# 1. First check what would be deleted
npx tsx scripts/hard-delete-project-comprehensive.ts 5800 --dry-run

# 2. Review the output carefully
# 3. If correct, proceed with actual deletion
npx tsx scripts/hard-delete-project-comprehensive.ts 5800 --force
```