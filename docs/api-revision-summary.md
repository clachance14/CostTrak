# CostTrak API Revision Summary

**Date:** January 31, 2025  
**Purpose:** Document all API changes made to align with simplified MVP database schema (13 core tables)

## Overview

CostTrak has been simplified from a complex enterprise system (~40 tables) to a lean MVP focused on three core imports:
1. **Budget Import** - One-time at project start
2. **Labor Import** - Weekly timecard updates  
3. **PO Import** - Weekly purchase order updates

## API Endpoints Removed

The following API directories and endpoints were completely removed:

### 1. Division Management APIs
- **Removed:** `/app/api/purchase-orders/by-division/` - Division-based PO filtering
- **Removed:** `/app/api/projects/multi-division/` - Multi-division project support
- **Reason:** `divisions` and `project_divisions` tables deleted

### 2. Notification APIs  
- **Removed:** `/app/api/data-imports/check-freshness/` - Import freshness notifications
- **Removed:** All notification creation logic in labor forecast APIs
- **Reason:** `notifications` table deleted

### 3. Financial Snapshot APIs
- **Removed:** References to financial snapshots in project APIs
- **Reason:** `financial_snapshots` table deleted

### 4. Client Management APIs
- **Removed:** Client references in project APIs
- **Reason:** `clients` table deleted

### 5. 2FA Authentication APIs
- **Removed:** `/app/api/auth/2fa/` directory (if it existed)
- **Reason:** `user_2fa_settings` table deleted

## API Endpoints Updated

### 1. Projects API (`/app/api/projects/`)
- **Removed:** `division_id` and `client_id` from all queries and responses
- **Removed:** Complex joins with `divisions` and `clients` tables
- **Removed:** `financial_snapshots` sub-queries
- **Updated:** Simplified to core project data only

### 2. Projects Detail API (`/app/api/projects/[id]/`)
- **Removed:** Division and client relationship queries
- **Removed:** Financial snapshot data
- **Removed:** Project divisions fetching logic
- **Updated:** Returns only core project data with purchase orders and labor forecasts

### 3. Purchase Orders API (`/app/api/purchase-orders/`)
- **Removed:** Division-based filtering logic
- **Removed:** `cost_codes` table references
- **Removed:** `division_name` column filter support
- **Updated:** Simplified category filtering using only `budget_category` field

### 4. Labor Forecasts API (`/app/api/labor-forecasts/`)
- **Removed:** All notification creation logic for variance alerts
- **Removed:** References to `notifications` table in:
  - POST `/api/labor-forecasts/` 
  - PATCH `/api/labor-forecasts/[id]/`
  - POST `/api/labor-forecasts/weekly/`
- **Updated:** Now only handles forecast creation/updates without alerts

### 5. User Management APIs
- **Removed:** `division_id` from user queries (`/app/api/users/`)
- **Removed:** `division_id` from user creation (`/app/api/auth/create-user/`)
- **Updated:** Users no longer associated with divisions

## New API Endpoints Created

### Change Orders API
Created missing core functionality for contract change management:

#### `GET /api/change-orders`
- List all change orders with pagination
- Filter by project_id and status
- Returns change order with project and user details

#### `POST /api/change-orders`
- Create new change order
- Validates unique CO number per project
- Updates project revised contract when approved

#### `GET /api/change-orders/[id]`
- Get single change order details
- Includes related project and user information

#### `PATCH /api/change-orders/[id]`
- Update change order (project managers only)
- Tracks approval with approved_by and approved_at
- Recalculates project revised contract on status change

#### `DELETE /api/change-orders/[id]`
- Soft delete (sets status to 'cancelled')
- Only allows deletion of draft or rejected orders
- Project managers only

## Type Definition Updates

### `/types/database.ts`
- **Removed:** `divisions` table definition
- **Removed:** `financial_snapshots` table definition  
- **Removed:** `user_2fa_settings` table definition
- **Removed:** `division_id` from `profiles` and `projects` tables
- **Removed:** `client_id` from `projects` table
- **Added:** `change_orders` table definition with full CRUD types

### `/types/api.ts`
- **Removed:** `FinancialSnapshot` interface
- **Removed:** Division references in `Project` interface
- **Updated:** Simplified project type without division/client relationships

## Database Schema Alignment

All APIs now align with the 13 core tables:
1. `profiles` - User authentication
2. `projects` - Basic project info
3. `employees` - Employee master list
4. `craft_types` - Labor categories
5. `purchase_orders` - PO tracking
6. `po_line_items` - PO details
7. `change_orders` - Contract changes
8. `labor_employee_actuals` - Weekly labor
9. `labor_headcount_forecasts` - Headcount projections
10. `budget_line_items` - Budget import
11. `data_imports` - Import history
12. `audit_log` - Change tracking
13. `project_budget_breakdowns` - Budget details

## Breaking Changes

1. **Division-based access control removed** - All authenticated users can access all data
2. **Notification system removed** - No automatic alerts for variances
3. **Client relationships removed** - Projects no longer linked to clients
4. **Multi-division projects removed** - Projects are single-entity only
5. **Financial snapshots removed** - No periodic financial captures

## Migration Impact

Applications using these APIs will need to:
1. Remove division_id from all API calls
2. Remove client_id from project creation/updates
3. Remove notification polling/handling
4. Update to use new change orders endpoints
5. Simplify permission checks (no division-based access)

## Testing Status

- Core import APIs need testing with valid authentication
- Change orders API implemented but needs integration testing
- Type generation needs to be run: `pnpm generate-types`
- Linting and type checking pending: `pnpm lint && pnpm type-check`