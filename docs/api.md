# API Documentation

## Overview

CostTrak uses Next.js 13+ App Router API routes with TypeScript, Zod validation, and Supabase for data persistence. All endpoints require authentication except login.

## Authentication

All API requests must include authentication headers:

```typescript
// Automatic with Supabase client
const { data, error } = await supabase
  .from('projects')
  .select('*')

// Manual API calls
fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
})
```

## Base Response Types

```typescript
// Success response
interface ApiResponse<T> {
  data: T
  error: null
}

// Error response
interface ApiErrorResponse {
  data: null
  error: {
    message: string
    code?: string
    details?: any
  }
}

// Paginated response
interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
}
```

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password

**Request:**
```json
{
  "email": "user@ics.ac",
  "password": "password123"
}
```

**Response:**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@ics.ac",
      "role": "project_manager",
      "full_name": "John Doe"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token"
    }
  }
}
```

#### POST /api/auth/logout
Logout current user

**Response:**
```json
{
  "data": { "success": true }
}
```

#### GET /api/auth/me
Get current user info

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@ics.ac",
    "role": "project_manager",
    "full_name": "John Doe",
    "department": "Operations",
    "division": "North"
  }
}
```

### Projects

#### GET /api/projects
List projects (filtered by user permissions)

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `division_id` (string): Filter by division ID
- `status` (string): Filter by status (planning/active/on_hold/completed/cancelled)
- `search` (string): Search by name or job number

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "job_number": "2024-001",
      "name": "North Plant Expansion",
      "division_id": "uuid",
      "client_id": "uuid",
      "project_manager_id": "uuid",
      "original_contract": 1500000,
      "revised_contract": 1650000,
      "status": "active",
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-12-31T00:00:00Z",
      "address": "123 Industrial Blvd",
      "city": "Houston",
      "state": "TX",
      "zip_code": "77001",
      "client": {
        "id": "uuid",
        "name": "ACME Corp"
      },
      "division": {
        "id": "uuid",
        "name": "Northern",
        "code": "NOR"
      },
      "project_manager": {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@ics.ac"
      },
      "purchase_orders": [{ "count": 45 }],
      "change_orders": [{ "count": 3 }],
      "labor_forecasts": [{ "count": 12 }]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### GET /api/projects/:id
Get project details

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "job_number": "2024-001",
    "name": "North Plant Expansion",
    "division_id": "uuid",
    "client_id": "uuid",
    "project_manager_id": "uuid",
    "original_contract": 1500000,
    "revised_contract": 1650000,
    "status": "active",
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-12-31T00:00:00Z",
    "address": "123 Industrial Blvd",
    "city": "Houston", 
    "state": "TX",
    "zip_code": "77001",
    "description": "Plant expansion project description",
    "created_by": "uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "client": {
      "id": "uuid",
      "name": "ACME Corp",
      "contact_name": "John Doe",
      "contact_email": "john@acme.com",
      "contact_phone": "555-1234"
    },
    "division": {
      "id": "uuid",
      "name": "Northern",
      "code": "NOR"
    },
    "project_manager": {
      "id": "uuid",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@ics.ac"
    },
    "created_by_user": {
      "id": "uuid",
      "first_name": "Mike",
      "last_name": "Manager"
    },
    "purchase_orders": [
      {
        "id": "uuid",
        "po_number": "PO-2024-001",
        "vendor_name": "ABC Supplies",
        "description": "Steel materials",
        "amount": 75000,
        "status": "approved",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "change_orders": [
      {
        "id": "uuid",
        "co_number": "CO-001",
        "description": "Additional work",
        "amount": 150000,
        "status": "approved",
        "created_at": "2024-01-20T10:00:00Z"
      }
    ],
    "labor_forecasts": [],
    "financial_snapshots": []
  }
}
```

#### POST /api/projects
Create new project (requires controller, executive, or ops_manager role)

**Request:**
```json
{
  "job_number": "2024-005",
  "name": "South Facility Upgrade",
  "division_id": "uuid",
  "client_id": "uuid",
  "project_manager_id": "uuid",
  "original_contract": 2500000,
  "start_date": "2024-02-01T00:00:00Z",
  "end_date": "2024-12-31T00:00:00Z",
  "status": "planning",
  "address": "456 Industrial Way",
  "city": "Dallas",
  "state": "TX",
  "zip_code": "75001",
  "description": "Facility upgrade project"
}
```

**Response (201 Created):**
```json
{
  "project": {
    "id": "new-uuid",
    "job_number": "2024-005",
    "name": "South Facility Upgrade",
    ...
  }
}
```

**Error Response (409 Conflict - Duplicate Job Number):**
```json
{
  "error": "Job number already exists"
}
```

#### PATCH /api/projects/:id
Update project (project managers can only update their own projects)

**Request:**
```json
{
  "name": "South Facility Upgrade - Phase 2",
  "status": "active",
  "end_date": "2025-03-31T00:00:00Z"
}
```

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "job_number": "2024-005",
    "name": "South Facility Upgrade - Phase 2",
    ...
  }
}
```

#### DELETE /api/projects/:id
Soft delete project (controller role only)

**Response:**
```json
{
  "message": "Project deleted successfully"
}
```

### Purchase Orders (Read-Only)

#### GET /api/purchase-orders
List all purchase orders with filtering and pagination

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `project_id` (string): Filter by project ID
- `status` (string): Filter by status (draft/approved/closed/cancelled)
- `vendor` (string): Filter by vendor name (partial match)
- `search` (string): Search PO number, vendor, or description
- `date_from` (date): Filter by issue date (from)
- `date_to` (date): Filter by issue date (to)

**Response:**
```json
{
  "purchase_orders": [
    {
      "id": "uuid",
      "po_number": "PO-2024-001",
      "vendor_name": "ABC Supplies",
      "description": "Steel materials",
      "committed_amount": 75000,
      "invoiced_amount": 50000,
      "status": "approved",
      "issue_date": "2024-01-15T00:00:00Z",
      "expected_delivery": "2024-02-01T00:00:00Z",
      "project": {
        "id": "uuid",
        "job_number": "2024-001",
        "name": "North Plant Expansion",
        "division": {
          "id": "uuid",
          "name": "Northern",
          "code": "NOR"
        }
      },
      "created_by_user": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe"
      },
      "po_line_items": [{ "count": 5 }]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "summary": {
    "totalCommitted": 2500000,
    "totalInvoiced": 1800000,
    "totalRemaining": 700000
  }
}
```

#### GET /api/purchase-orders/:id
Get single purchase order with full details

**Response:**
```json
{
  "purchase_order": {
    "id": "uuid",
    "po_number": "PO-2024-001",
    "vendor_name": "ABC Supplies",
    "description": "Steel materials for foundation",
    "committed_amount": 75000,
    "invoiced_amount": 50000,
    "status": "approved",
    "issue_date": "2024-01-15T00:00:00Z",
    "expected_delivery": "2024-02-01T00:00:00Z",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-20T14:30:00Z",
    "project": {
      "id": "uuid",
      "job_number": "2024-001",
      "name": "North Plant Expansion",
      "status": "active",
      "division": {
        "id": "uuid",
        "name": "Northern",
        "code": "NOR"
      },
      "client": {
        "id": "uuid",
        "name": "ACME Corp"
      },
      "project_manager": {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@ics.ac"
      }
    },
    "created_by_user": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@ics.ac"
    },
    "approved_by_user": {
      "id": "uuid",
      "first_name": "Mike",
      "last_name": "Manager",
      "email": "mike@ics.ac"
    },
    "po_line_items": [
      {
        "id": "uuid",
        "line_number": 1,
        "description": "Steel beams - Type A",
        "quantity": 100,
        "unit_price": 500,
        "total_amount": 50000
      },
      {
        "id": "uuid",
        "line_number": 2,
        "description": "Steel plates - 1/2 inch",
        "quantity": 50,
        "unit_price": 500,
        "total_amount": 25000
      }
    ],
    "calculated": {
      "lineItemsTotal": 75000,
      "variance": 0,
      "invoicedPercentage": 66.67,
      "remainingAmount": 25000
    }
  }
}
```

#### GET /api/projects/:projectId/purchase-orders
List POs for a specific project

**Query Parameters:**
- `status` (string): Filter by status
- `vendor` (string): Filter by vendor name

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "job_number": "2024-001",
    "name": "North Plant Expansion"
  },
  "purchase_orders": [
    {
      "id": "uuid",
      "po_number": "PO-2024-001",
      "vendor_name": "ABC Supplies",
      "description": "Steel materials",
      "committed_amount": 75000,
      "invoiced_amount": 50000,
      "status": "approved",
      "issue_date": "2024-01-15T00:00:00Z",
      "created_by_user": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe"
      },
      "po_line_items": [{ "count": 2 }]
    }
  ],
  "summary": {
    "totalPOs": 15,
    "totalCommitted": 450000,
    "totalInvoiced": 320000,
    "totalRemaining": 130000,
    "byStatus": {
      "draft": 2,
      "approved": 10,
      "closed": 3,
      "cancelled": 0
    }
  }
}
```

#### POST /api/purchase-orders/import
Import POs from CSV/Excel file

**Request (multipart/form-data):**
```
file: purchase_orders.csv (required)
project_id: uuid (optional - overrides project_job_number in file)
```

**CSV Format:**
```csv
project_job_number,po_number,vendor_name,description,committed_amount,invoiced_amount,status,issue_date,expected_delivery
2024-001,PO-2024-001,ABC Supplies,Steel materials,75000,50000,approved,2024-01-15,2024-02-01
2024-001,PO-2024-002,XYZ Electric,Electrical components,45000,0,draft,2024-01-20,2024-02-15
```

**Response:**
```json
{
  "data": {
    "success": true,
    "imported": 25,
    "updated": 10,
    "skipped": 2,
    "errors": [
      {
        "row": 15,
        "field": "committed_amount",
        "message": "Invalid number format",
        "data": { ... }
      }
    ]
  }
}
```

**Import Notes:**
- File formats supported: CSV, XLSX, XLS
- Upsert logic: Matches by po_number + project_id
- Required fields: project_job_number (or project_id), po_number, vendor_name, committed_amount
- Optional fields: description, invoiced_amount, status, issue_date, expected_delivery
- Status values: draft, approved, closed, cancelled (default: approved)
- Dates should be in YYYY-MM-DD format
- Amounts should be numeric (no currency symbols)

### Labor Forecasts

#### GET /api/projects/:projectId/labor
Get labor data for project

**Query Parameters:**
- `period_start` (date): Start date filter
- `period_end` (date): End date filter
- `craft_type` (string): Filter by craft

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "period_start": "2024-01-01",
      "period_end": "2024-01-07",
      "craft_type": "Mechanical",
      "group_type": "Direct",
      "actual_hours": 320,
      "actual_cost": 28800,
      "forecasted_hours": 350,
      "forecasted_cost": 31500
    }
  ]
}
```

#### POST /api/projects/:projectId/labor
Create/update labor forecast

**Request:**
```json
{
  "period_start": "2024-01-08",
  "period_end": "2024-01-14",
  "entries": [
    {
      "craft_type": "Mechanical",
      "group_type": "Direct",
      "forecasted_hours": 380,
      "forecasted_cost": 34200
    },
    {
      "craft_type": "I&E",
      "group_type": "Direct",
      "forecasted_hours": 200,
      "forecasted_cost": 22000
    }
  ]
}
```

### Change Orders

#### GET /api/change-orders
List all change orders with filtering

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `project_id` (uuid): Filter by project
- `status` (string): Filter by status (pending, approved, rejected, cancelled)
- `search` (string): Search CO number or description
- `sort_by` (string): Sort field (co_number, amount, submitted_date, created_at)
- `sort_order` (string): Sort direction (asc, desc)

**Response:**
```json
{
  "changeOrders": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "coNumber": "CO-001",
      "description": "Additional foundation work required",
      "amount": 50000,
      "status": "pending",
      "impactScheduleDays": 14,
      "submittedDate": "2024-01-20T00:00:00Z",
      "approvedDate": null,
      "createdAt": "2024-01-20T10:00:00Z",
      "updatedAt": "2024-01-20T10:00:00Z",
      "project": {
        "id": "uuid",
        "jobNumber": "2024-001",
        "name": "North Plant Expansion",
        "division": "Northern"
      },
      "createdBy": "Emily ProjectManager",
      "approvedBy": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### POST /api/change-orders
Create new change order

**Access:** Controller, Ops Manager, Project Manager

**Request:**
```json
{
  "project_id": "uuid",
  "co_number": "CO-003",
  "description": "Additional electrical work for new equipment",
  "amount": 35000,
  "impact_schedule_days": 7,
  "submitted_date": "2024-01-25T00:00:00Z",
  "status": "pending"
}
```

**Response (201 Created):**
```json
{
  "changeOrder": {
    "id": "new-uuid",
    "projectId": "uuid",
    "coNumber": "CO-003",
    "description": "Additional electrical work for new equipment",
    "amount": 35000,
    "status": "pending",
    "impactScheduleDays": 7,
    "submittedDate": "2024-01-25T00:00:00Z",
    "project": {
      "id": "uuid",
      "jobNumber": "2024-001",
      "name": "North Plant Expansion"
    }
  }
}
```

#### GET /api/change-orders/:id
Get single change order details

**Response:**
```json
{
  "changeOrder": {
    "id": "uuid",
    "projectId": "uuid",
    "coNumber": "CO-001",
    "description": "Additional foundation work required",
    "amount": 50000,
    "status": "approved",
    "impactScheduleDays": 14,
    "submittedDate": "2024-01-20T00:00:00Z",
    "approvedDate": "2024-01-22T15:30:00Z",
    "createdAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-22T15:30:00Z",
    "project": {
      "id": "uuid",
      "jobNumber": "2024-001",
      "name": "North Plant Expansion",
      "originalContract": 1000000,
      "revisedContract": 1050000,
      "division": {
        "id": "uuid",
        "name": "Northern",
        "code": "NOR"
      },
      "client": {
        "id": "uuid",
        "name": "ABC Corporation"
      }
    },
    "createdBy": {
      "id": "uuid",
      "name": "Emily ProjectManager",
      "email": "pm1@ics.ac"
    },
    "approvedBy": {
      "id": "uuid",
      "name": "Mike OpsManager",
      "email": "opsmanager@ics.ac"
    }
  },
  "auditTrail": [
    {
      "action": "approve",
      "changes": {
        "status": { "from": "pending", "to": "approved" },
        "approved_by": "uuid",
        "approved_date": "2024-01-22T15:30:00Z"
      },
      "timestamp": "2024-01-22T15:30:00Z",
      "user": "Mike OpsManager"
    },
    {
      "action": "create",
      "changes": { "created": { ... } },
      "timestamp": "2024-01-20T10:00:00Z",
      "user": "Emily ProjectManager"
    }
  ]
}
```

#### PATCH /api/change-orders/:id
Update change order

**Access:** 
- Cannot edit approved or cancelled change orders
- Project managers can only edit their own projects' COs

**Request:**
```json
{
  "description": "Additional foundation work required - revised scope",
  "amount": 55000,
  "impact_schedule_days": 21
}
```

**Response:**
```json
{
  "changeOrder": {
    "id": "uuid",
    "projectId": "uuid",
    "coNumber": "CO-001",
    "description": "Additional foundation work required - revised scope",
    "amount": 55000,
    "status": "pending",
    "impactScheduleDays": 21,
    "submittedDate": "2024-01-20T00:00:00Z",
    "approvedDate": null
  }
}
```

#### DELETE /api/change-orders/:id
Soft delete change order

**Access:** Controller only, cannot delete approved COs

**Response:**
```json
{
  "message": "Change order deleted successfully"
}
```

#### POST /api/change-orders/:id/approve
Approve a change order

**Access:** 
- Controller: Any amount
- Ops Manager: Up to $50,000

**Request:**
```json
{
  "reason": "Within budget allocation",
  "approved_date": "2024-01-22T15:30:00Z"  // Optional, defaults to now
}
```

**Response:**
```json
{
  "message": "Change order approved successfully",
  "changeOrder": {
    "id": "uuid",
    "coNumber": "CO-001",
    "status": "approved",
    "approvedDate": "2024-01-22T15:30:00Z",
    "approvedBy": "uuid"
  },
  "projectUpdate": {
    "originalContract": 1000000,
    "revisedContract": 1055000,
    "changeOrderImpact": 55000
  }
}
```

**Error Response (403 Forbidden - Amount exceeds authority):**
```json
{
  "error": "Change orders over $50,000 require controller approval"
}
```

#### POST /api/change-orders/:id/reject
Reject a change order

**Access:** Controller, Ops Manager

**Request:**
```json
{
  "reason": "Scope not aligned with project objectives"
}
```

**Response:**
```json
{
  "message": "Change order rejected successfully",
  "changeOrder": {
    "id": "uuid",
    "coNumber": "CO-001",
    "status": "rejected",
    "rejectionReason": "Scope not aligned with project objectives"
  }
}
```

#### POST /api/change-orders/import
Import change orders from CSV (Not yet implemented)

**Request (multipart/form-data):**
```
file: change_orders.csv
```

**CSV Format:**
```csv
project_job_number,co_number,description,amount,impact_schedule_days,status,submitted_date
2024-001,CO-001,Additional foundation work,50000,14,pending,2024-01-20
2024-001,CO-002,Electrical upgrades,25000,7,approved,2024-01-15
```

### Dashboards

#### GET /api/dashboards/company
Get company-wide metrics and performance overview

**Required Role**: Controller or Executive

**Response:**
```json
{
  "data": {
    "overview": {
      "activeProjects": 28,
      "totalBacklog": 45000000,
      "averageMargin": 22.5,
      "recentCommittedCosts": 2100000,
      "lastUpdated": "2024-01-31T14:30:00Z"
    },
    "divisionBreakdown": [
      {
        "name": "Northern",
        "projectCount": 8,
        "totalValue": 12500000
      },
      {
        "name": "Southern",
        "projectCount": 6,
        "totalValue": 9800000
      }
    ],
    "statusDistribution": {
      "planning": 5,
      "active": 28,
      "on_hold": 3,
      "completed": 12,
      "cancelled": 2
    },
    "topProjects": [
      {
        "id": "uuid",
        "jobNumber": "2024-001",
        "name": "North Plant Expansion",
        "value": 5500000,
        "status": "active",
        "projectManager": "Jane Smith"
      }
    ],
    "financialSnapshot": null
  }
}
```

#### GET /api/dashboards/division/:divisionId
Get division-specific metrics and project details

**Required Role**: Controller, Executive, Ops Manager (all divisions), or role with matching division_id

**Path Parameters:**
- `divisionId` (uuid): Division ID

**Response:**
```json
{
  "data": {
    "division": {
      "id": "uuid",
      "name": "Northern",
      "code": "NOR",
      "description": "Northern Division Operations"
    },
    "overview": {
      "totalProjects": 15,
      "activeProjects": 8,
      "totalContractValue": 12500000,
      "activeContractValue": 8200000,
      "totalCommitted": 6500000,
      "totalInvoiced": 4200000,
      "averageMargin": 24.3
    },
    "statusDistribution": {
      "planning": 2,
      "active": 8,
      "on_hold": 1,
      "completed": 4
    },
    "topProjects": [
      {
        "id": "uuid",
        "jobNumber": "2024-001",
        "name": "North Plant Expansion",
        "status": "active",
        "client": "ACME Corp",
        "projectManager": "Jane Smith",
        "contractValue": 2500000,
        "margin": 18.5,
        "startDate": "2024-01-01",
        "endDate": "2024-12-31"
      }
    ],
    "allProjects": [...],
    "recentActivity": {
      "newPOs": 12,
      "period": "last30days"
    },
    "lastUpdated": "2024-01-31T14:30:00Z"
  }
}
```

#### GET /api/dashboards/project/:projectId
Get comprehensive project dashboard data with financial metrics

**Required Role**: Any authenticated user with project access (role-based or viewer access)

**Path Parameters:**
- `projectId` (uuid): Project ID

**Response:**
```json
{
  "data": {
    "project": {
      "id": "uuid",
      "jobNumber": "2024-001",
      "name": "North Plant Expansion",
      "status": "active",
      "description": "Major facility expansion project",
      "address": "123 Industrial Blvd",
      "city": "Houston",
      "state": "TX",
      "zipCode": "77001",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "client": {
        "id": "uuid",
        "name": "ACME Corporation",
        "contactName": "John Doe",
        "contactEmail": "john@acme.com",
        "contactPhone": "555-1234"
      },
      "division": {
        "id": "uuid",
        "name": "Northern",
        "code": "NOR"
      },
      "projectManager": {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@ics.ac"
      },
      "createdBy": "Mike Manager",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-31T14:30:00Z"
    },
    "financialSummary": {
      "originalContract": 1500000,
      "changeOrders": 150000,
      "revisedContract": 1650000,
      "committedCosts": 980000,
      "invoicedAmount": 650000,
      "actualCosts": 770000,
      "forecastedCosts": 1200000,
      "estimatedProfit": 450000,
      "marginPercent": 27.3,
      "percentComplete": 46.7,
      "remainingBudget": 670000
    },
    "purchaseOrders": {
      "summary": {
        "totalPOs": 25,
        "totalCommitted": 980000,
        "totalInvoiced": 650000,
        "byStatus": {
          "draft": 2,
          "approved": 20,
          "closed": 3
        }
      },
      "recent": [
        {
          "id": "uuid",
          "poNumber": "PO-2024-025",
          "vendor": "ABC Supplies",
          "amount": 45000,
          "invoiced": 0,
          "status": "approved",
          "issueDate": "2024-01-25"
        }
      ]
    },
    "changeOrders": {
      "total": 3,
      "approvedAmount": 150000,
      "recent": [
        {
          "id": "uuid",
          "coNumber": "CO-001",
          "description": "Additional foundation work",
          "amount": 75000,
          "status": "approved",
          "scheduleImpact": 14,
          "createdAt": "2024-01-15T10:00:00Z"
        }
      ]
    },
    "laborForecast": {
      "totalActualHours": 2400,
      "totalActualCost": 120000,
      "totalForecastedHours": 5000,
      "totalForecastedCost": 250000
    },
    "recentActivity": [
      {
        "action": "update",
        "entityType": "project",
        "changes": { "status": { "from": "planning", "to": "active" } },
        "timestamp": "2024-01-31T14:30:00Z",
        "userId": "uuid"
      }
    ],
    "lastUpdated": "2024-01-31T14:30:00Z"
  }
}
```

### Reports & Export

#### GET /api/reports/export
Export data to Excel/CSV

**Query Parameters:**
- `type` (string): Report type (projects, purchase_orders, labor)
- `format` (string): Export format (xlsx, csv)
- `division` (string): Filter by division
- `project_id` (string): Filter by project
- `date_from` (date): Start date
- `date_to` (date): End date

**Response:**
Returns file download

### Notifications

#### GET /api/notifications
Get user notifications

**Query Parameters:**
- `unread_only` (boolean): Show only unread

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "threshold_breach",
      "priority": "high",
      "title": "Project Margin Alert",
      "message": "PRJ-001 margin dropped below 10%",
      "related_entity_type": "project",
      "related_entity_id": "uuid",
      "is_read": false,
      "created_at": "2024-01-31T10:00:00Z"
    }
  ]
}
```

#### PUT /api/notifications/:id/read
Mark notification as read

**Response:**
```json
{
  "data": { "success": true }
}
```

#### GET /api/notifications/settings
Get notification settings

**Response:**
```json
{
  "data": {
    "email_enabled": true,
    "thresholds": {
      "margin_warning": 10,
      "margin_critical": 5,
      "budget_warning": 90,
      "budget_critical": 100
    }
  }
}
```

### Utility Endpoints

#### GET /api/divisions
List all divisions

**Response:**
```json
{
  "divisions": [
    {
      "id": "uuid",
      "name": "Northern",
      "code": "NOR",
      "description": "Northern Division",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET /api/clients
List all active clients

**Response:**
```json
{
  "clients": [
    {
      "id": "uuid",
      "name": "ACME Corporation",
      "code": "ACME",
      "contact_name": "John Doe",
      "contact_email": "john@acme.com",
      "contact_phone": "555-1234",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### System/Admin

#### GET /api/users
List users (requires controller, executive, or ops_manager role)

**Query Parameters:**
- `role` (string): Filter by user role

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@ics.ac",
      "first_name": "John",
      "last_name": "Doe",
      "role": "project_manager",
      "division_id": "uuid"
    }
  ]
}
```

#### POST /api/auth/create-user
Create new user (controller role only)

**Request:**
```json
{
  "email": "newuser@ics.ac",
  "password": "SecurePass123!",
  "first_name": "New",
  "last_name": "User",
  "role": "viewer",
  "division_id": "uuid" // Optional, required for ops_manager role
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "newuser@ics.ac",
    "first_name": "New", 
    "last_name": "User",
    "role": "viewer",
    "division_id": null
  },
  "message": "User created successfully"
}
```

#### PUT /api/users/:id
Update user (admin only)

**Request:**
```json
{
  "role": "project_manager",
  "division": "South",
  "is_active": true
}
```

## Error Handling

### Error Response Format

```json
{
  "data": null,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request validation failed
- `DUPLICATE_ENTRY` - Unique constraint violation
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited:
- Authenticated requests: 100 requests per minute
- Import endpoints: 10 requests per minute
- Export endpoints: 20 requests per hour

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706735400
```

## Webhooks (Future)

Planned webhook events:
- `project.created`
- `project.status_changed`
- `threshold.breached`
- `import.completed`

## API Versioning

Currently v1 (implicit). Future versions will use:
- URL versioning: `/api/v2/projects`
- Header versioning: `API-Version: 2`

## SDK Usage Examples

### TypeScript/JavaScript

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// Get projects
const { data, error } = await supabase
  .from('projects')
  .select('*, project_manager:users(full_name)')
  .eq('status', 'Active')
  .order('created_at', { ascending: false })

// Create project
const { data, error } = await supabase
  .from('projects')
  .insert({
    job_number: 'PRJ-003',
    name: 'New Project',
    division: 'North',
    contract_value: 1000000
  })
  .select()
  .single()
```

### Direct API Calls

```typescript
// Using fetch
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    job_number: 'PRJ-003',
    name: 'New Project',
    division: 'North',
    contract_value: 1000000
  })
})

const result = await response.json()
```

## Testing

### Example cURL Commands

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@ics.ac","password":"password123"}'

# Get projects
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create project
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_number":"PRJ-003","name":"Test Project","division":"North","contract_value":1000000}'
```

### Postman Collection

Import the Postman collection from `/docs/postman/costtrak-api.json` for complete API testing.