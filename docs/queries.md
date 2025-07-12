# Query Optimization & Dashboard Queries

## Overview

CostTrak's query strategy balances real-time data needs with performance requirements. We use a combination of indexed queries, materialized views, and strategic caching to achieve <2 second dashboard load times.

## Query Optimization Strategy

### 1. Index Strategy

```sql
-- Primary access pattern indexes
CREATE INDEX idx_projects_division_status ON projects(division, status);
CREATE INDEX idx_projects_pm ON projects(project_manager_id);
CREATE INDEX idx_projects_client ON projects(client_id);

-- Purchase order indexes
CREATE INDEX idx_pos_project_status ON purchase_orders(project_id, status);
CREATE INDEX idx_pos_po_number ON purchase_orders(po_number);
CREATE INDEX idx_pos_created_at ON purchase_orders(created_at);

-- Labor forecast indexes
CREATE INDEX idx_labor_project_period ON labor_forecasts(project_id, period_start);
CREATE INDEX idx_labor_craft_group ON labor_forecasts(craft_type, group_type);

-- Change order indexes
CREATE INDEX idx_co_project_status ON change_orders(project_id, status);
CREATE INDEX idx_co_approved_at ON change_orders(approved_at) WHERE status = 'Approved';

-- Financial snapshot indexes
CREATE INDEX idx_snapshots_lookup ON financial_snapshots(snapshot_date, metric_type, project_id);
CREATE INDEX idx_snapshots_division ON financial_snapshots(snapshot_date, division) WHERE project_id IS NULL;

-- Notification indexes
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at);
```

### 2. Materialized Views

```sql
-- Project financial summary (refresh hourly)
CREATE MATERIALIZED VIEW mv_project_summary AS
SELECT 
    p.id,
    p.job_number,
    p.name,
    p.division,
    p.client_id,
    p.contract_value,
    p.status,
    p.project_manager_id,
    -- Change orders
    COALESCE(co.approved_count, 0) as change_order_count,
    COALESCE(co.approved_amount, 0) as change_order_amount,
    p.contract_value + COALESCE(co.approved_amount, 0) as revised_contract_value,
    -- Purchase orders
    COALESCE(po.po_count, 0) as po_count,
    COALESCE(po.committed_total, 0) as committed_total,
    COALESCE(po.invoiced_total, 0) as invoiced_total,
    -- Labor
    COALESCE(lf.actual_hours, 0) as labor_actual_hours,
    COALESCE(lf.actual_cost, 0) as labor_actual_cost,
    COALESCE(lf.forecast_hours, 0) as labor_forecast_hours,
    COALESCE(lf.forecast_cost, 0) as labor_forecast_cost,
    -- Calculated fields
    p.contract_value + COALESCE(co.approved_amount, 0) - 
        COALESCE(po.committed_total, 0) - COALESCE(lf.forecast_cost, 0) as projected_profit,
    CASE 
        WHEN p.contract_value + COALESCE(co.approved_amount, 0) > 0 THEN
            ((p.contract_value + COALESCE(co.approved_amount, 0) - 
              COALESCE(po.committed_total, 0) - COALESCE(lf.forecast_cost, 0)) / 
             (p.contract_value + COALESCE(co.approved_amount, 0)) * 100)
        ELSE 0
    END as margin_percent
FROM projects p
LEFT JOIN (
    SELECT project_id, 
           COUNT(*) as approved_count,
           SUM(amount) as approved_amount
    FROM change_orders 
    WHERE status = 'Approved'
    GROUP BY project_id
) co ON p.id = co.project_id
LEFT JOIN (
    SELECT project_id,
           COUNT(*) as po_count,
           SUM(committed_amount) as committed_total,
           SUM(invoiced_amount) as invoiced_total
    FROM purchase_orders
    WHERE status != 'Draft'
    GROUP BY project_id
) po ON p.id = po.project_id
LEFT JOIN (
    SELECT project_id,
           SUM(actual_hours) as actual_hours,
           SUM(actual_cost) as actual_cost,
           SUM(forecasted_hours) as forecast_hours,
           SUM(forecasted_cost) as forecast_cost
    FROM labor_forecasts
    GROUP BY project_id
) lf ON p.id = lf.project_id;

CREATE UNIQUE INDEX ON mv_project_summary(id);
CREATE INDEX ON mv_project_summary(division, status);
CREATE INDEX ON mv_project_summary(project_manager_id);

-- Division summary (refresh every 30 minutes)
CREATE MATERIALIZED VIEW mv_division_summary AS
SELECT 
    division,
    COUNT(*) FILTER (WHERE status = 'Active') as active_projects,
    COUNT(*) as total_projects,
    SUM(contract_value) as total_contract_value,
    SUM(revised_contract_value) as total_revised_value,
    AVG(margin_percent) FILTER (WHERE margin_percent IS NOT NULL) as avg_margin_percent,
    SUM(committed_total) as total_committed,
    SUM(labor_forecast_cost) as total_labor_forecast
FROM mv_project_summary
GROUP BY division;

CREATE UNIQUE INDEX ON mv_division_summary(division);
```

### 3. Refresh Strategy

```sql
-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_financial_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_division_summary;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (using pg_cron or external scheduler)
-- Every hour for project summary
-- Every 30 minutes for division summary
```

## Common Dashboard Queries

### Company Dashboard

```typescript
// src/lib/queries/dashboard.ts
import { supabase } from '@/lib/supabase'

export async function getCompanyMetrics() {
  // Get latest snapshot data
  const today = new Date().toISOString().split('T')[0]
  
  const { data: metrics } = await supabase
    .from('financial_snapshots')
    .select('metric_type, value')
    .eq('snapshot_date', today)
    .is('project_id', null)
    .is('division', null)
  
  // Get active project count and totals
  const { data: projectStats } = await supabase
    .from('mv_project_summary')
    .select(`
      status,
      revised_contract_value,
      margin_percent
    `)
    .eq('status', 'Active')
  
  const activeProjects = projectStats?.length || 0
  const totalBacklog = projectStats?.reduce((sum, p) => sum + p.revised_contract_value, 0) || 0
  const avgMargin = projectStats?.reduce((sum, p) => sum + p.margin_percent, 0) / activeProjects || 0
  
  return {
    cash_on_hand: metrics?.find(m => m.metric_type === 'cash_on_hand')?.value || 0,
    total_backlog: totalBacklog,
    average_margin: avgMargin,
    net_income: metrics?.find(m => m.metric_type === 'net_income')?.value || 0,
    active_projects: activeProjects,
    as_of_date: today
  }
}
```

### Division Dashboard

```typescript
export async function getDivisionMetrics(division: string) {
  const { data } = await supabase
    .from('mv_division_summary')
    .select('*')
    .eq('division', division)
    .single()
  
  // Get project list for division
  const { data: projects } = await supabase
    .from('mv_project_summary')
    .select(`
      id,
      job_number,
      name,
      project_manager:users!project_manager_id(full_name),
      revised_contract_value,
      margin_percent,
      committed_total,
      status
    `)
    .eq('division', division)
    .order('margin_percent', { ascending: true })
    .limit(10)
  
  return {
    summary: data,
    projects: projects || [],
    lowMarginProjects: projects?.filter(p => p.margin_percent < 10) || []
  }
}
```

### Project Detail Query

```typescript
export async function getProjectDetail(projectId: string) {
  // Single query with relationships
  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients(*),
      project_manager:users!project_manager_id(*),
      purchase_orders(
        id,
        po_number,
        vendor_name,
        committed_amount,
        invoiced_amount,
        status,
        created_at
      ),
      change_orders(
        id,
        co_number,
        description,
        amount,
        status,
        created_at
      ),
      recent_labor:labor_forecasts(
        craft_type,
        group_type,
        actual_cost,
        forecasted_cost,
        period_start
      )
    `)
    .eq('id', projectId)
    .eq('purchase_orders.status', 'Approved')
    .order('purchase_orders.created_at', { ascending: false })
    .order('change_orders.created_at', { ascending: false })
    .gte('recent_labor.period_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .single()
  
  return project
}
```

### Real-time Notifications

```typescript
export function subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()
}
```

## Reporting Queries

### PO Summary Report

```typescript
export async function getPOSummaryReport(filters: {
  division?: string
  project_id?: string
  date_from?: string
  date_to?: string
}) {
  let query = supabase
    .from('purchase_orders')
    .select(`
      *,
      project:projects(job_number, name, division)
    `)
  
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }
  
  if (filters.division) {
    query = query.eq('project.division', filters.division)
  }
  
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }
  
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to)
  }
  
  const { data } = await query.order('created_at', { ascending: false })
  
  return data
}
```

### Labor Variance Report

```typescript
export async function getLaborVarianceReport(projectId: string, periodStart: string) {
  const { data } = await supabase
    .from('labor_forecasts')
    .select('*')
    .eq('project_id', projectId)
    .gte('period_start', periodStart)
    .order('period_start', { ascending: true })
  
  // Calculate variances
  const variances = data?.map(entry => ({
    ...entry,
    hours_variance: entry.actual_hours - entry.forecasted_hours,
    cost_variance: entry.actual_cost - entry.forecasted_cost,
    variance_percent: entry.forecasted_cost > 0 
      ? ((entry.actual_cost - entry.forecasted_cost) / entry.forecasted_cost * 100)
      : 0
  }))
  
  return variances
}
```

## Performance Monitoring

### Query Performance Views

```sql
-- Create view for monitoring slow queries
CREATE VIEW query_performance AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE query LIKE '%projects%' OR query LIKE '%purchase_orders%'
ORDER BY mean_time DESC
LIMIT 20;

-- Monitor index usage
CREATE VIEW index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
```

### Query Optimization Tips

1. **Use materialized views** for complex aggregations
2. **Batch related queries** to reduce round trips
3. **Leverage indexes** on foreign keys and filter columns
4. **Paginate large result sets**
5. **Use select specific columns** instead of SELECT *
6. **Cache stable data** (like user roles, divisions)
7. **Monitor query performance** regularly

## Supabase Query Builder Patterns

### Efficient Joins

```typescript
// Good: Single query with joins
const { data } = await supabase
  .from('projects')
  .select(`
    *,
    client:clients(name),
    manager:users!project_manager_id(full_name)
  `)

// Avoid: Multiple queries
const projects = await supabase.from('projects').select('*')
for (const project of projects.data) {
  const client = await supabase.from('clients').select('*').eq('id', project.client_id)
  // N+1 query problem
}
```

### Aggregations

```typescript
// Use RPC for complex aggregations
const { data } = await supabase
  .rpc('get_project_summary', { 
    project_id: projectId 
  })

// RPC function definition
CREATE OR REPLACE FUNCTION get_project_summary(project_id uuid)
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'total_pos', (SELECT COUNT(*) FROM purchase_orders WHERE project_id = $1),
    'total_committed', (SELECT SUM(committed_amount) FROM purchase_orders WHERE project_id = $1),
    'labor_forecast', (SELECT SUM(forecasted_cost) FROM labor_forecasts WHERE project_id = $1)
  );
END;
$$ LANGUAGE plpgsql;
```

### Pagination

```typescript
export async function getPaginatedProjects(page: number = 1, pageSize: number = 20) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  const { data, count } = await supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false })
  
  return {
    data,
    page,
    pageSize,
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}
```

## Caching Strategy

### React Query Setup

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

// Cache configuration by query type
export const queryConfig = {
  companyDashboard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000 // 30 minutes
  },
  projectList: {
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000 // 5 minutes
  },
  projectDetail: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000 // 5 minutes
  }
}
```