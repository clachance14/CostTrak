# CostTrak Database Schema

## Overview

CostTrak uses PostgreSQL (via Supabase) with a normalized schema designed for financial tracking, project management, and real-time reporting in industrial construction.

## Core Tables

### Users
**Purpose**: Store user accounts with role-based access control  
**Key Fields**:
- `id` (UUID): Primary key, matches Supabase Auth UID
- `email`: Must end with @ics.ac domain
- `role`: Defines system-wide permissions (executive, ops_manager, project_manager, accounting, controller, viewer)
- `division`: Optional, used for ops_manager filtering
- `is_active`: Soft delete functionality

**Relationships**:
- Referenced by most tables for audit trails
- Links to `user_project_access` for granular permissions

### Projects
**Purpose**: Central entity for all construction projects  
**Key Fields**:
- `job_number`: Unique identifier used by the business
- `division`: For organizational grouping and access control
- `contract_value`: Original contract amount
- `status`: Active/Closed lifecycle
- `project_manager_id`: Primary PM assignment

**Computed Fields**:
- `revised_contract_value`: Auto-calculated with approved change orders

**Relationships**:
- Parent to: purchase_orders, change_orders, extra_costs, labor_forecasts
- References: clients, users (PM)

### Purchase Orders
**Purpose**: Track committed costs and vendor relationships  
**Key Fields**:
- `po_number`: Business identifier
- `committed_amount`: Original PO value
- `invoiced_amount`: Amount actually invoiced
- `status`: Draft/Approved/Closed workflow

**Relationships**:
- Belongs to: projects
- Has many: po_line_items
- References: users (created_by, approved_by)

### Labor Forecasts
**Purpose**: Track and forecast labor costs by craft and type  
**Key Fields**:
- `period_start/end`: Time period for aggregation
- `craft_type`: Mechanical, I&E, Civil
- `group_type`: Direct, Indirect, Staff
- `actual_hours/cost`: What was spent
- `forecasted_hours/cost`: Projected spend

**Design Notes**:
- Aggregated by period to avoid individual timesheet complexity
- Supports weekly or monthly rollups

### Change Orders
**Purpose**: Track contract modifications and their impact  
**Key Fields**:
- `co_number`: Business identifier
- `amount`: Value change (positive or negative)
- `status`: Pending/Approved/Rejected
- `impact_schedule_days`: Schedule impact tracking

**Relationships**:
- Belongs to: projects
- Affects: project.revised_contract_value (when approved)

### Financial Snapshots
**Purpose**: Pre-calculated metrics for dashboard performance  
**Key Fields**:
- `snapshot_date`: When metric was calculated
- `metric_type`: cash_on_hand, margin, backlog, etc.
- `value`: Numeric metric value
- `project_id`: NULL for company-wide metrics
- `division`: NULL for company-wide, set for division rollups

**Design Notes**:
- Enables fast dashboard loading
- Updated via scheduled jobs or triggers
- Historical tracking for trends

## Supporting Tables

### Clients
Simple client/customer tracking linked to projects.

### User Project Access
Many-to-many relationship for granular project permissions beyond role-based access.

### PO Line Items
Detailed breakdown of purchase order contents.

### Extra Costs
Unplanned costs requiring justification and approval.

### Budget Categories
Project-level budget groupings (future enhancement ready).

### Notifications
System alerts and threshold breach notifications.

### Audit Log
Comprehensive change tracking for compliance.

### System Settings
Key-value store for configurable thresholds and parameters.

## Key Design Principles

1. **Normalization**: Avoid data duplication while maintaining query performance
2. **Audit Trail**: All financial tables track created_by and timestamps
3. **Soft Deletes**: Use status fields rather than hard deletes
4. **Extensibility**: Schema supports future WBS and document management features
5. **Performance**: Strategic indexes and computed fields for common calculations

## Common Relationships

```
Company
  └── Divisions
      └── Projects
          ├── Purchase Orders
          │   └── Line Items
          ├── Labor Forecasts
          ├── Change Orders
          └── Extra Costs
```

## Migration Considerations

- The `users` table syncs with Supabase Auth
- Historical data imports should populate audit fields appropriately
- Use `created_at` timestamps to maintain data chronology
- Preserve original PO numbers and job numbers from legacy systems