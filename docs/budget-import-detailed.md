# Detailed Budget Import Documentation

## Overview

CostTrak now supports importing detailed budget data from Excel coversheets, storing individual cost categories that enable powerful cross-discipline queries. The system automatically extracts disciplines from the BUDGETS sheet and builds a hierarchical WBS structure. This documentation covers the BUDGETS sheet structure and query capabilities.

## BUDGETS Sheet Structure

The BUDGETS sheet contains 12-row blocks for each discipline. The discipline name is stored in column B (merged across 12 rows) and serves as the source for building the project's WBS structure. Each block contains the following categories:

1. **DIRECT LABOR** - Direct craft labor costs and manhours
2. **INDIRECT LABOR** - Supervision and support labor
3. **ALL LABOR** - Subtotal of all labor (not stored separately)
4. **TAXES & INSURANCE** - Labor burden costs
5. **PERDIEM** - Per diem allowances for workers
6. **ADD ONS** - Additional labor-related costs
7. **SMALL TOOLS & CONSUMABLES** - Minor equipment and supplies
8. **MATERIALS** - Direct material costs
9. **EQUIPMENT** - Equipment rental and ownership costs
10. **SUBCONTRACTS** - Subcontracted work
11. **RISK** - Risk contingency
12. **DISCIPLINE TOTALS** - Grand total (not stored separately)

## Data Storage Strategy

Each cost category is stored as a separate line item in the `budget_line_items` table with:
- `cost_type` field identifying the specific category
- `discipline` field for the discipline name (extracted from BUDGETS sheet)
- `category` field for the broad category (LABOR, MATERIAL, etc.)
- Full cost breakdown preserving all detail

The WBS structure is automatically generated from the disciplines found in the BUDGETS sheet, eliminating the need for manual discipline configuration or INPUT sheet dependencies.

## Query Capabilities

### 1. Query Total Perdiem Across All Disciplines

```sql
-- Using the project_cost_type_summary view
SELECT total_cost 
FROM project_cost_type_summary
WHERE project_id = 'your-project-id'
  AND cost_type = 'PERDIEM';
```

API Endpoint:
```
GET /api/projects/{id}/budget-by-cost-type
```

Response includes all perdiem costs across disciplines.

### 2. Query Total Materials by Discipline

```sql
-- Using the budget_cost_type_rollup view
SELECT discipline, total_cost
FROM budget_cost_type_rollup
WHERE project_id = 'your-project-id'
  AND cost_type = 'MATERIALS'
ORDER BY total_cost DESC;
```

API Endpoint:
```
GET /api/projects/{id}/budget-by-cost-type?group_by_discipline=true
```

### 3. Compare Direct vs Indirect Labor

```sql
SELECT cost_type, SUM(total_cost) as total, SUM(manhours) as hours
FROM budget_line_items
WHERE project_id = 'your-project-id'
  AND cost_type IN ('DIRECT LABOR', 'INDIRECT LABOR')
GROUP BY cost_type;
```

### 4. Find All Equipment Costs

```sql
SELECT discipline, total_cost, description
FROM budget_line_items
WHERE project_id = 'your-project-id'
  AND cost_type = 'EQUIPMENT'
ORDER BY discipline, total_cost DESC;
```

## API Usage Examples

### Get Cost Type Summary
```bash
curl -X GET \
  'https://your-app.com/api/projects/{project-id}/budget-by-cost-type' \
  -H 'Authorization: Bearer your-token'
```

Response:
```json
{
  "project": {
    "id": "...",
    "name": "Project Name",
    "job_number": "2024-001"
  },
  "costTypes": [
    {
      "cost_type": "MATERIALS",
      "discipline_count": 5,
      "line_item_count": 5,
      "total_cost": 543210.50,
      "total_manhours": 0,
      "avg_cost_per_hour": null
    },
    {
      "cost_type": "PERDIEM",
      "discipline_count": 3,
      "line_item_count": 3,
      "total_cost": 123456.00,
      "total_manhours": 0,
      "avg_cost_per_hour": null
    }
  ],
  "summary": {
    "totalCostTypes": 10,
    "grandTotal": 2500000.00,
    "totalManhours": 50000,
    "averageCostPerHour": 50.00
  }
}
```

### Get Cost Types Grouped by Discipline
```bash
curl -X GET \
  'https://your-app.com/api/projects/{project-id}/budget-by-cost-type?group_by_discipline=true' \
  -H 'Authorization: Bearer your-token'
```

Response includes discipline breakdown for each cost type.

## Database Views

### budget_cost_type_rollup
Aggregates budget data by cost type and discipline:
- `project_id` - Project identifier
- `cost_type` - Specific cost category (e.g., PERDIEM)
- `discipline` - Discipline name
- `total_cost` - Sum of costs
- `total_manhours` - Sum of manhours (for labor categories)

### project_cost_type_summary
Project-level summary across all disciplines:
- `project_id` - Project identifier
- `cost_type` - Specific cost category
- `discipline_count` - Number of disciplines with this cost type
- `total_cost` - Total cost across all disciplines
- `avg_cost_per_hour` - Average hourly rate (for labor categories)

## Benefits

1. **Granular Queries**: Query any cost category across all disciplines
2. **Flexibility**: Analyze costs by discipline, category, or type
3. **Accuracy**: Preserves all detail from Excel import
4. **Performance**: Indexed views for fast queries
5. **Compliance**: Detailed audit trail of all costs

## Construction Industry Use Cases

1. **Per Diem Analysis**: Track total per diem costs across all crafts
2. **Material Planning**: Aggregate material costs by discipline
3. **Labor Analysis**: Compare direct vs indirect labor ratios
4. **Equipment Utilization**: Track equipment costs by project phase
5. **Small Tools Tracking**: Monitor consumables spending
6. **Risk Assessment**: Analyze risk contingency by discipline

This detailed storage approach enables construction finance teams to perform sophisticated cost analysis while maintaining the granularity needed for accurate project financial management.