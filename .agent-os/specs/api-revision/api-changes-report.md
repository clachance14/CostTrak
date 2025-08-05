# CostTrak API Changes Report

**Date:** 2025-08-01  
**Revision:** Simplification to MVP (13-table schema)

## Executive Summary

CostTrak has been simplified from a complex enterprise system to a lean MVP focused on three core imports: Budget (one-time), Labor (weekly), and Purchase Orders (weekly). This report documents all API changes made to align with the simplified database schema.

## 1. Removed API Endpoints

### Authentication & Security
- ✅ `/api/auth/2fa/enable` - Removed 2FA setup
- ✅ `/api/auth/2fa/setup` - Removed 2FA configuration  
- ✅ `/api/auth/2fa/verify` - Removed 2FA verification

### Deprecated Features
- ✅ `/api/clients/*` - Client management removed
- ✅ `/api/divisions/*` - Division management removed
- ✅ `/api/documents/*` - Document management removed
- ✅ `/api/financial-snapshots/*` - Financial snapshots removed
- ✅ `/api/notifications/*` - Notification system removed
- ✅ `/api/invoices/*` - Invoice management removed
- ✅ `/api/cost-codes/*` - Cost code management removed
- ✅ `/api/labor-categories/*` - Labor categories removed

### Complex Dashboard Features
- ✅ `/api/dashboards/company` - Company dashboard removed
- ✅ `/api/dashboards/division/*` - Division dashboards removed
- ✅ `/api/ops-manager/*` - Ops manager views removed
- ✅ `/api/project-manager/my-projects-budget` - Role-specific view removed

### Multi-Division Project Features
- ✅ `/api/projects/[id]/divisions/*` - All division-related endpoints
- ✅ `/api/projects/[id]/dashboard-summary` - Complex dashboard removed
- ✅ `/api/projects/[id]/financial-summary` - Financial summary removed

### Experimental/Test Endpoints
- ✅ `/api/projects/[id]/budget-by-cost-type` - Experimental feature
- ✅ `/api/projects/[id]/budget-vs-actual-enhanced` - Enhanced version
- ✅ `/api/project-budgets/import-coversheet-v2` - V2 import removed
- ✅ `/api/test/*` - All test endpoints

## 2. Modified API Endpoints

### `/api/auth/login`
- **Change**: Removed 2FA logic
- **Status**: Simplified to basic email/password authentication
- **Breaking Changes**: None (2FA was optional)

### `/api/projects`
- **Changes**: 
  - Removed `division_count` calculation
  - Removed division filtering
  - Removed client and division references
- **Status**: Simplified to core project fields
- **Breaking Changes**: 
  - Response no longer includes `division_count`
  - Cannot filter by division

### `/api/projects/[id]`
- **Changes**: 
  - Removed division_id from responses
  - Removed risk_factors and complexity fields
- **Status**: Returns simplified project structure
- **Breaking Changes**: Missing fields in response

## 3. Core APIs Preserved

### Authentication
- `/api/auth/login` - Simple email/password login (✅ Verified)

### Project Management  
- `/api/projects` - List and create projects (✅ Verified)
- `/api/projects/[id]` - Get, update, delete projects (✅ Verified)
- `/api/projects/[id]/budget-vs-actual` - Core financial view (✅ Verified)

### Import Endpoints (Critical)
- `/api/project-budgets/import-coversheet` - Budget import (✅ Verified)
- `/api/labor-import` - Labor import (❌ MISSING - Needs creation)
- `/api/purchase-orders/import` - PO import (❌ MISSING - Needs creation)

### Data Access
- `/api/purchase-orders` - List and create POs (✅ Verified)
- `/api/change-orders` - Change orders (❌ MISSING - Needs creation)

### Labor Forecasting
- `/api/labor-forecasts/headcount` - Headcount forecasting (✅ Verified)
- `/api/labor-forecasts/[id]` - Individual forecasts (✅ Verified)
- `/api/labor-forecasts/composite-rate` - Rate calculations (✅ Verified)
- `/api/labor-forecasts/running-averages` - Running averages (✅ Verified)
- `/api/labor-forecasts/weekly-actuals` - Weekly actuals (✅ Verified)

### Reference Data
- `/api/employees` - Employee list (❌ MISSING - Needs creation)
- `/api/craft-types` - Labor categories (❌ MISSING - Needs creation)

## 4. Required New APIs

### 1. Labor Import API
**Endpoint**: `/api/labor-import`  
**Method**: POST  
**Purpose**: Weekly timecard data import  
**Requirements**:
- Parse Excel/CSV labor data
- Match employees by ID
- Calculate Direct/Indirect based on craft_types
- Create labor_employee_actuals records
- Track import in data_imports table

### 2. Purchase Order Import API
**Endpoint**: `/api/purchase-orders/import`  
**Method**: POST  
**Purpose**: Weekly PO data import  
**Requirements**:
- Parse Excel/CSV PO data
- Create purchase_orders and po_line_items
- Track import in data_imports table

### 3. Change Orders API
**Endpoints**: 
- `/api/change-orders` (GET, POST)
- `/api/change-orders/[id]` (GET, PUT, DELETE)
**Purpose**: Manage contract modifications  
**Requirements**:
- CRUD operations for change orders
- Update project revised_contract
- Simple approval workflow

### 4. Employee Reference API
**Endpoint**: `/api/employees`  
**Method**: GET  
**Purpose**: List employees with classification  
**Requirements**:
- Return all employees
- Include Direct/Indirect classification
- Support search/filtering

### 5. Craft Types Reference API
**Endpoint**: `/api/craft-types`  
**Method**: GET  
**Purpose**: List labor categories  
**Requirements**:
- Return all craft types
- Include billing rates
- Include Direct/Indirect classification

## 5. TypeScript Updates

### Removed Interfaces
- `FinancialSnapshot` - No longer used
- Division-related interfaces
- Notification interfaces
- Client interfaces

### Updated Interfaces
- `Project` - Removed financial_snapshots relation
- `ProjectListItem` - Removed division_count

## 6. Migration Guide for Frontend

### Breaking Changes
1. **Project List Response**:
   ```typescript
   // Before
   { 
     projects: [...], 
     division_count: 3 
   }
   
   // After
   { 
     projects: [...] 
   }
   ```

2. **Authentication**:
   - No 2FA endpoints available
   - Simple email/password only

3. **Project Details**:
   - No division_id field
   - No risk_factors or complexity

### New Import Workflow
1. Create project via `/api/projects`
2. Import budget via `/api/project-budgets/import-coversheet` (one-time)
3. Weekly imports:
   - Labor: `/api/labor-import` 
   - POs: `/api/purchase-orders/import`

## 7. Next Steps

1. **Immediate Actions**:
   - Create missing API endpoints (labor import, PO import, change orders)
   - Create reference data APIs (employees, craft types)
   - Generate new TypeScript types from database

2. **Testing**:
   - Verify all three import workflows
   - Test budget vs actual calculations
   - Ensure data_imports tracking works

3. **Documentation**:
   - Update API documentation
   - Create import format specifications
   - Document validation rules

## 8. Risk Assessment

**Low Risk**:
- Most deprecated features were already removed
- Core functionality preserved
- Import workflows intact

**Medium Risk**:
- Missing import APIs need immediate creation
- Frontend may need updates for breaking changes

**Mitigation**:
- Prioritize creation of missing APIs
- Provide clear migration guide
- Test all import scenarios