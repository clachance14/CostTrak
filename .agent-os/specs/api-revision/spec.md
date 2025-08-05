# API Revision Specification

## Objective
Revise all CostTrak APIs to align with simplified MVP architecture after database simplification from ~40 tables to 13 core tables.

## Context
CostTrak has been simplified to focus on three core imports:
1. **Budget Import** - One-time at project start
2. **Labor Import** - Weekly timecard updates  
3. **PO Import** - Weekly purchase order updates

## Removed Features to Clean
The following features and their APIs must be removed:
- Division management endpoints
- Notification endpoints  
- Complex WBS endpoints
- Financial snapshots
- 2FA authentication endpoints
- Client management
- Multi-division project support
- Invoice endpoints
- Cost code management
- Labor category management

## Core APIs to Preserve/Update

### 1. Authentication
- `/api/auth/login` - Simplify (remove 2FA)
- `/api/auth/logout` - Keep as-is
- `/api/auth/session` - Keep as-is

### 2. Projects 
- `/api/projects` - Update to remove division_id, risk_factors
- `/api/projects/[id]` - Simplify response structure
- `/api/projects/[id]/budget-vs-actual` - Keep core functionality

### 3. Import Endpoints (Critical)
- `/api/project-budgets/import-coversheet` - Preserve
- `/api/labor-import` - Preserve  
- `/api/purchase-orders/import` - Preserve

### 4. Data Access
- `/api/purchase-orders` - Keep simplified
- `/api/change-orders` - Keep as-is
- `/api/employees` - Keep with Direct/Indirect flag
- `/api/craft-types` - Keep as-is
- `/api/labor-forecasts/*` - Review and simplify

### 5. Reporting
- `/api/projects/[id]/budget-vs-actual` - Core report
- `/api/projects/[id]/budget-by-cost-type` - May need updates

## Implementation Tasks

### Phase 1: Discovery
1. Scan all routes in `/app/api` directory
2. Create inventory of endpoints referencing removed tables
3. Identify API dependencies and service layer impacts

### Phase 2: Cleanup
1. Delete entire route directories for removed features:
   - `/api/divisions/*`
   - `/api/notifications/*`
   - `/api/financial-snapshots/*`
   - `/api/clients/*`
   - `/api/auth/2fa/*`
   
2. Update project-related endpoints:
   - Remove division_id from all queries
   - Remove risk_factors, complexity fields
   - Simplify response DTOs

### Phase 3: Update Core APIs
1. Simplify authentication (remove 2FA flows)
2. Update project CRUD to match new schema
3. Ensure import endpoints use correct table structures
4. Update labor forecast endpoints for simplified model

### Phase 4: Type Safety
1. Generate new TypeScript types from database
2. Update `/types/api.ts` with new interfaces
3. Remove unused type definitions
4. Update service layer types

### Phase 5: Testing & Documentation
1. Create test suite for simplified APIs
2. Document all breaking changes
3. Update API examples
4. Create migration guide for frontend

## Success Criteria
- All APIs work with 13-table schema
- No references to dropped tables
- Import workflows functional
- TypeScript compilation passes
- Core reports (Budget vs Actual) working
- All tests passing

## Removed API Endpoints List
Document each removed endpoint:
```
DELETE /api/divisions
DELETE /api/divisions/[id]
DELETE /api/notifications
DELETE /api/notifications/[id]
DELETE /api/notifications/unread-count
DELETE /api/financial-snapshots
DELETE /api/financial-snapshots/[id]
DELETE /api/auth/2fa/enable
DELETE /api/auth/2fa/verify
DELETE /api/auth/2fa/setup
DELETE /api/clients
DELETE /api/invoices
DELETE /api/cost-codes
DELETE /api/labor-categories
```

## API Changes Documentation Template
For each modified API, document:
- **Endpoint**: Path
- **Change Type**: Modified/Removed
- **Breaking Changes**: List of changes
- **Migration Steps**: How to update clients
- **New Response Format**: If applicable