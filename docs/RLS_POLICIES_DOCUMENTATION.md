# CostTrak Row Level Security (RLS) Documentation

## Overview

Row Level Security (RLS) is a PostgreSQL feature that enables fine-grained access control at the row level. In CostTrak, RLS ensures that users can only access data they are authorized to see based on their role, division, and specific assignments.

## Why RLS is Critical for CostTrak

1. **Multi-tenant Security**: Ensures data isolation between divisions and projects
2. **Role-based Access**: Enforces permissions based on user roles (controller, executive, ops_manager, etc.)
3. **Data Privacy**: Prevents unauthorized access to sensitive financial data
4. **Audit Compliance**: Provides traceable access control for regulatory requirements
5. **Scalability**: Security rules are enforced at the database level, not application level

## User Roles and Permissions

### Role Hierarchy

1. **Controller** (Highest)
   - Full system access
   - Can view/edit all data across all divisions
   - Can manage users and system settings
   - Can generate company-wide reports

2. **Executive**
   - Read-only access to all projects and divisions
   - Can view financial summaries and reports
   - Cannot edit project data

3. **Operations Manager**
   - Full access to projects within their assigned division
   - Can create/edit projects, POs, change orders
   - Cannot access projects outside their division

4. **Project Manager**
   - Full access to their assigned projects only
   - Can manage POs, change orders, labor forecasts
   - Cannot access other projects

5. **Accounting**
   - Read access to financial data across all projects
   - Can export reports and view invoices
   - Limited edit capabilities

6. **Viewer** (Lowest)
   - Read-only access to assigned projects
   - Cannot make any modifications

## Table-by-Table RLS Policies

### 1. Users Table

```sql
-- Policy: users_select_policy
-- Purpose: Users can only see other users in their division (except controllers/executives)
-- Implementation:
SELECT: 
  - Controllers/Executives: Can see all users
  - Others: Can only see users in their division or users without division assignment

-- Policy: users_update_own_profile
-- Purpose: Users can update their own profile (except role changes)
-- Implementation:
UPDATE: 
  - Users can update their own record
  - Cannot change their own role

-- Policy: users_manage_policy  
-- Purpose: Only controllers can create/update other users
-- Implementation:
INSERT/UPDATE/DELETE:
  - Only controllers have full CRUD access
```

### 2. Projects Table

```sql
-- Policy: projects_select_policy
-- Purpose: Control project visibility based on role and assignment
-- Implementation:
SELECT:
  - Controllers/Executives: All projects
  - Ops Managers: Projects in their division
  - Project Managers: Only their assigned projects
  - Others: No access

-- Policy: projects_insert_policy
-- Purpose: Control who can create new projects
-- Implementation:
INSERT:
  - Controllers: Can create in any division
  - Ops Managers: Can create in their division only

-- Policy: projects_update_policy
-- Purpose: Control project modifications
-- Implementation:
UPDATE:
  - Controllers: Can update any project
  - Ops Managers: Can update projects in their division
  - Project Managers: Can update their assigned projects

-- Policy: projects_delete_policy
-- Purpose: Soft delete control (only controllers)
-- Implementation:
UPDATE (for soft delete):
  - Only controllers can set deleted_at
```

### 3. Purchase Orders Table

```sql
-- Policy: purchase_orders_view
-- Purpose: Inherit access from associated project
-- Implementation:
SELECT:
  - If user can see the project, they can see its POs

-- Policy: purchase_orders_manage
-- Purpose: Control PO creation and modification
-- Implementation:
INSERT/UPDATE:
  - Controllers: All POs
  - Ops Managers: POs in their division's projects
  - Project Managers: POs in their assigned projects

-- Policy: purchase_orders_approve
-- Purpose: Approval limits by role
-- Implementation:
UPDATE (status change to 'approved'):
  - Controllers: No limit
  - Ops Managers: Up to $100,000
  - Project Managers: Up to $25,000
```

### 4. Change Orders Table

```sql
-- Policy: change_orders_access
-- Purpose: Same access as project
-- Implementation:
ALL:
  - Inherit project access permissions
  - No additional approval workflow (per requirements)
```

### 5. Labor Management Tables

```sql
-- Policy: labor_actuals_access
-- Purpose: Control labor cost entry
-- Implementation:
ALL:
  - Same as project access
  - Project managers can enter actuals
  - Ops managers can review/approve

-- Policy: labor_forecasts_access  
-- Purpose: Control forecast modifications
-- Implementation:
ALL:
  - Same as project access
  - Only PM and above can modify forecasts
```

### 6. Financial Snapshots Table

```sql
-- Policy: financial_snapshots_view
-- Purpose: Control access to financial rollups
-- Implementation:
SELECT:
  - Controllers/Executives: All snapshots
  - Ops Managers: Division and project snapshots for their division
  - Project Managers: Only their project snapshots
  - Accounting: All snapshots (read-only)

-- Policy: financial_snapshots_generate
-- Purpose: Control who can trigger snapshot generation
-- Implementation:
INSERT:
  - Controllers: Company/Division/Project level
  - Ops Managers: Division/Project level (own division)
  - System/Automated: Via service role
```

### 7. Documents Table

```sql
-- Policy: documents_access
-- Purpose: Inherit from related entity
-- Implementation:
ALL:
  - Access based on entity_type and entity_id
  - If user can access the project/PO/CO, they can access its documents
  - Users can always delete documents they uploaded
```

### 8. Notifications Table

```sql
-- Policy: notifications_personal
-- Purpose: Users only see their own notifications
-- Implementation:
ALL:
  - Users can only see/update notifications where user_id = auth.uid()
  - System can create notifications for any user
```

### 9. Audit Log Table

```sql
-- Policy: audit_log_view
-- Purpose: Audit trail access control
-- Implementation:
SELECT:
  - Controllers: All audit logs
  - Others: Only audit logs for entities they can access
  
-- Policy: audit_log_insert_only
-- Purpose: Append-only audit trail
-- Implementation:
INSERT:
  - All authenticated users can insert
  - No UPDATE or DELETE allowed
```

## Implementation Patterns

### 1. Project-Based Access Pattern

Most tables use a pattern where access is determined by project access:

```sql
EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = [table].project_id
  AND (
    -- User role checks
    (user.role IN ('controller', 'executive')) OR
    (user.role = 'ops_manager' AND user.division_id = p.division_id) OR
    (user.role = 'project_manager' AND p.project_manager_id = user.id)
  )
)
```

### 2. Division-Based Access Pattern

For division-level operations:

```sql
user.role = 'controller' OR
(user.role = 'ops_manager' AND user.division_id = resource.division_id)
```

### 3. Self-Access Pattern

For user-specific resources:

```sql
auth.uid() = resource.user_id
```

## Testing RLS Policies

### Test Queries by Role

```sql
-- Test as Controller
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "controller-user-id", "role": "authenticated"}';
SELECT * FROM projects; -- Should see all

-- Test as Ops Manager
SET request.jwt.claims = '{"sub": "ops-manager-id", "role": "authenticated"}';
SELECT * FROM projects; -- Should see only division projects

-- Test as Project Manager  
SET request.jwt.claims = '{"sub": "pm-user-id", "role": "authenticated"}';
SELECT * FROM projects; -- Should see only assigned projects
```

### Bypass RLS for Testing

```sql
-- Disable RLS (DEVELOPMENT ONLY)
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS (REQUIRED FOR PRODUCTION)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
```

## Security Best Practices

1. **Always Enable RLS in Production**
   - Never deploy with RLS disabled
   - Test all policies before production deployment

2. **Use Service Role Sparingly**
   - Only for system operations (migrations, automated tasks)
   - Never expose service role key to client

3. **Audit Policy Changes**
   - Track all RLS policy modifications
   - Review policies during security audits

4. **Performance Considerations**
   - Index foreign keys used in policies
   - Monitor query performance with RLS enabled
   - Consider materialized views for complex access patterns

5. **Testing Requirements**
   - Test each role's access thoroughly
   - Verify users cannot access unauthorized data
   - Test edge cases (null values, role changes)

## Migration to Production Checklist

- [ ] Enable RLS on all tables
- [ ] Verify all policies are created
- [ ] Test each user role
- [ ] Verify no data leaks between divisions/projects
- [ ] Performance test with RLS enabled
- [ ] Document any custom policies
- [ ] Set up monitoring for policy violations
- [ ] Train administrators on RLS implications

## Troubleshooting Common Issues

### "Permission Denied" Errors
1. Check if RLS is enabled on the table
2. Verify user's role and assignments
3. Check policy conditions
4. Ensure auth.uid() is set correctly

### Performance Degradation
1. Add indexes on policy condition columns
2. Simplify complex policy logic
3. Consider caching user permissions
4. Use connection pooling

### Policy Not Working
1. Check policy is enabled: `\d+ table_name`
2. Verify policy syntax
3. Test with explicit role setting
4. Check for conflicting policies

## Conclusion

RLS is essential for CostTrak's security model. While it can be disabled during development for convenience, it MUST be enabled in production to ensure proper data isolation and access control. This documentation should be reviewed and updated as the application evolves.