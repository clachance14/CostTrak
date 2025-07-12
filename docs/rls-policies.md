# Row Level Security (RLS) Policies

## Overview

CostTrak implements Row Level Security at the database level to ensure users only access data they're authorized to see. This provides defense-in-depth security beyond application-level checks.

## Policy Architecture

### Hierarchy of Access

1. **Controllers**: Full system access
2. **Executives**: Read access to all data
3. **Accounting**: Read access to all financial data
4. **Operations Managers**: Full access within their division
5. **Project Managers**: Full access to assigned projects
6. **Viewers**: Read-only access to specifically granted projects

## Core RLS Policies

### Enable RLS on All Tables

```sql
-- Enable RLS (run for each table)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
```

### User Table Policies

```sql
-- Users can view their own profile
-- Controllers can view all users
CREATE POLICY users_select ON users FOR SELECT
USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'controller')
);

-- Only controllers can modify users
CREATE POLICY users_modify ON users FOR ALL
USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'controller')
);
```

### Project Access Policies

```sql
-- Select policy based on role hierarchy
CREATE POLICY projects_select ON projects FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            -- Executives, Controllers, Accounting see all
            u.role IN ('executive', 'controller', 'accounting') OR
            
            -- Ops Managers see their division
            (u.role = 'ops_manager' AND u.division = projects.division) OR
            
            -- PMs see their assigned projects
            (u.role = 'project_manager' AND projects.project_manager_id = u.id) OR
            
            -- Explicit project access grants
            EXISTS (
                SELECT 1 FROM user_project_access upa 
                WHERE upa.user_id = u.id AND upa.project_id = projects.id
            )
        )
    )
);

-- Insert/Update restricted to ops_manager and above
CREATE POLICY projects_insert ON projects FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('ops_manager', 'controller')
        -- Ops managers can only create in their division
        AND (role = 'controller' OR division = NEW.division)
    )
);

CREATE POLICY projects_update ON projects FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'controller' OR
            (u.role = 'ops_manager' AND u.division = projects.division) OR
            (u.role = 'project_manager' AND projects.project_manager_id = u.id)
        )
    )
);
```

### Financial Data Policies

```sql
-- Purchase Orders inherit project permissions
CREATE POLICY purchase_orders_select ON purchase_orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = purchase_orders.project_id
        -- RLS on projects table will filter appropriately
    )
);

-- Only specific roles can create/modify POs
CREATE POLICY purchase_orders_modify ON purchase_orders FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM projects p
        JOIN users u ON u.id = auth.uid()
        WHERE p.id = purchase_orders.project_id
        AND (
            u.role IN ('controller', 'accounting') OR
            (u.role = 'ops_manager' AND u.division = p.division) OR
            (u.role = 'project_manager' AND p.project_manager_id = u.id)
        )
    )
);

-- Similar pattern for change_orders and extra_costs
CREATE POLICY change_orders_select ON change_orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = change_orders.project_id
    )
);

CREATE POLICY labor_forecasts_select ON labor_forecasts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = labor_forecasts.project_id
    )
);
```

### Notification Policies

```sql
-- Users only see their own notifications
CREATE POLICY notifications_select ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Only the recipient can mark as read
CREATE POLICY notifications_update ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Audit Log Policies

```sql
-- Only controllers and accounting can view audit logs
CREATE POLICY audit_log_select ON audit_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('controller', 'accounting')
    )
);

-- Audit logs are insert-only (no updates/deletes)
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
WITH CHECK (true); -- System can always insert
```

## Helper Functions

### Get Current User Role

```sql
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text AS $$
BEGIN
    RETURN (
        SELECT role FROM users WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Check Project Access

```sql
CREATE OR REPLACE FUNCTION user_has_project_access(project_id uuid)
RETURNS boolean AS $$
DECLARE
    user_role text;
    user_division text;
BEGIN
    SELECT role, division INTO user_role, user_division
    FROM users WHERE id = auth.uid();
    
    -- Controllers, executives, accounting have universal access
    IF user_role IN ('controller', 'executive', 'accounting') THEN
        RETURN true;
    END IF;
    
    -- Check division-based access for ops managers
    IF user_role = 'ops_manager' THEN
        RETURN EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = project_id 
            AND p.division = user_division
        );
    END IF;
    
    -- Check PM assignment
    IF user_role = 'project_manager' THEN
        RETURN EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = project_id 
            AND p.project_manager_id = auth.uid()
        );
    END IF;
    
    -- Check explicit access grant
    RETURN EXISTS (
        SELECT 1 FROM user_project_access upa
        WHERE upa.user_id = auth.uid() 
        AND upa.project_id = project_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Testing RLS Policies

### Test as Different Users

```sql
-- Switch to a specific user for testing
SET request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';

-- Test queries
SELECT * FROM projects; -- Should only show authorized projects
SELECT * FROM purchase_orders; -- Should only show POs for authorized projects

-- Reset to default
RESET request.jwt.claims;
```

### Common Test Scenarios

```typescript
// TypeScript test example
async function testProjectAccess(userId: string) {
  // Impersonate user
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId);
    
  console.log(`User ${userId} can see ${data?.length || 0} projects`);
}

// Test different roles
await testProjectAccess('executive-user-id');    // Should see all
await testProjectAccess('pm-user-id');          // Should see assigned only
await testProjectAccess('viewer-user-id');      // Should see granted only
```

## Performance Considerations

1. **Index foreign keys** used in RLS policies:
   ```sql
   CREATE INDEX idx_user_project_access_user ON user_project_access(user_id);
   CREATE INDEX idx_projects_pm ON projects(project_manager_id);
   CREATE INDEX idx_projects_division ON projects(division);
   ```

2. **Use EXISTS instead of IN** for better performance

3. **Cache user role** in application context to minimize lookups

4. **Monitor slow queries** and adjust policies as needed

## Debugging RLS Issues

1. **Check auth context**:
   ```sql
   SELECT auth.uid(); -- Current user ID
   SELECT auth.jwt(); -- Full JWT claims
   ```

2. **Test without RLS** (admin only):
   ```sql
   SET row_security = off; -- Dangerous! Admin only
   -- Run queries
   SET row_security = on;
   ```

3. **Use EXPLAIN** to see policy impact:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) 
   SELECT * FROM projects WHERE division = 'North';
   ```

## Security Best Practices

1. **Always use RLS** - Never rely solely on application-level security
2. **Principle of least privilege** - Grant minimum necessary access
3. **Audit policy changes** - Track who modifies RLS policies
4. **Regular reviews** - Audit user access quarterly
5. **Test thoroughly** - Verify policies work as expected before deployment