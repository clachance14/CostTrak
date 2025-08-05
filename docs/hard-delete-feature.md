# Hard Delete Feature Documentation

## Overview

The hard delete feature allows authorized users (controllers only) to permanently remove a project and all its related data from the CostTrak system. This is different from the soft delete feature, which only marks a project as deleted but retains all data.

## Key Features

### 1. Comprehensive Data Deletion
The hard delete function removes data from 23 related tables:
- Labor tables (actuals, employee actuals, headcount forecasts, running averages)
- Purchase order tables (POs, line items, project-specific line items)
- Change order tables (change orders, attachments)
- Financial tables (budgets, breakdowns, snapshots, forecasts, invoices)
- Division tables (divisions, budgets, forecasts)
- Metadata tables (imports, audit logs, notification triggers, user access)

### 2. Safety Features
- **Dry Run Mode**: Preview what will be deleted without actually deleting
- **Confirmation Code**: Requires typing `DELETE-{job_number}` to confirm
- **Role-Based Access**: Only controllers can perform hard deletes
- **Audit Logging**: All deletion attempts are logged
- **Transaction Safety**: Deletes are performed in the correct order to respect foreign key constraints

### 3. Storage Cleanup
- Optionally deletes file attachments from Supabase storage
- Removes entire project folders from storage buckets
- Handles change order attachment cleanup

## API Endpoints

### GET /api/projects/{id}/hard-delete
Preview what would be deleted for a project.

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "job_number": "5800",
    "name": "Project Name"
  },
  "affectedRecords": {
    "purchase_orders": 10,
    "po_line_items": 45,
    "change_orders": 5,
    // ... other tables
  },
  "totalRecords": 234,
  "confirmationCode": "DELETE-5800"
}
```

### POST /api/projects/{id}/hard-delete
Perform the actual hard delete.

**Request Body:**
```json
{
  "confirmationCode": "DELETE-5800",
  "deleteAttachments": true,
  "dryRun": false
}
```

**Response:**
```json
{
  "message": "Project permanently deleted",
  "deletedRecords": {
    "projects": 1,
    "purchase_orders": 10,
    // ... other tables
  },
  "totalDeleted": 234
}
```

## Usage

### Command Line Script
```bash
# Dry run to preview deletion
npx tsx scripts/hard-delete-project-v2.ts 5800 --dry-run

# Actual deletion
npx tsx scripts/hard-delete-project-v2.ts 5800
```

### Programmatic Usage
```typescript
import { hardDeleteProject } from '@/lib/projects/hard-delete'

// Preview deletion
const dryRunResult = await hardDeleteProject(supabase, '5800', { 
  dryRun: true 
})

// Perform deletion
const result = await hardDeleteProject(supabase, '5800', {
  dryRun: false,
  deleteAttachments: true
})

if (result.success) {
  console.log(`Deleted ${result.totalRecordsDeleted} records`)
} else {
  console.error('Errors:', result.errors)
}
```

### UI Component
```tsx
import { HardDeleteDialog } from '@/components/project/hard-delete-dialog'

<HardDeleteDialog
  project={project}
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={() => router.push('/projects')}
/>
```

## Database Tables Affected

The following tables are checked and cleaned during hard delete:

1. **Labor Data**
   - labor_employee_actuals
   - labor_actuals
   - labor_headcount_forecasts
   - labor_running_averages

2. **Purchase Orders**
   - purchase_orders
   - po_line_items
   - project_po_line_items (CASCADE)

3. **Change Orders**
   - change_orders
   - co_attachments (CASCADE)

4. **Financial Data**
   - invoices (CASCADE)
   - financial_snapshots
   - project_budgets
   - project_budget_breakdowns
   - project_contract_breakdowns
   - monthly_forecasts

5. **Division Data**
   - project_divisions (CASCADE)
   - division_budgets (CASCADE)
   - division_forecasts (CASCADE)

6. **Metadata**
   - user_project_access
   - data_imports (CASCADE)
   - audit_log
   - notification_triggers

## Security Considerations

1. **Authorization**: Only users with the 'controller' role can perform hard deletes
2. **Audit Trail**: All deletion attempts (including dry runs) are logged in the audit_log table
3. **Confirmation**: Requires explicit confirmation code to prevent accidental deletions
4. **No Cascade Triggers**: The function explicitly deletes from each table to ensure complete cleanup

## Testing

A comprehensive test script is available:
```bash
npx tsx scripts/test-hard-delete.ts
```

This script:
1. Creates a test project with related data
2. Tests dry run mode
3. Performs actual deletion
4. Verifies all data is removed
5. Checks audit log creation

## Best Practices

1. **Always run a dry run first** to understand what will be deleted
2. **Backup critical data** before performing hard deletes in production
3. **Use soft delete** for most cases - hard delete should be rare
4. **Document the reason** for hard deletion in your organization's records
5. **Consider data retention policies** before implementing hard deletes

## Limitations

1. **No Undo**: Once data is hard deleted, it cannot be recovered
2. **No Bulk Delete**: Projects must be deleted one at a time
3. **Storage Cleanup**: Requires proper storage bucket configuration
4. **Performance**: Large projects with extensive data may take time to delete

## Future Enhancements

1. **Batch Deletion**: Support for deleting multiple projects
2. **Scheduled Cleanup**: Automatic hard delete of soft-deleted projects after X days
3. **Export Before Delete**: Option to export all project data before deletion
4. **Partial Delete**: Option to retain certain types of data (e.g., keep audit logs)