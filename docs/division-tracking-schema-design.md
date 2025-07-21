# Multi-Division Budget Tracking Schema Design

## Overview
This document outlines the database schema modifications required to support multi-division budget tracking in CostTrak, where projects can have multiple divisions (Mechanical, I&E, Civil, etc.) with separate budgets, project managers, and cost tracking.

## Division Mapping Strategy

### 1. Discipline to Division Mapping
Based on the existing discipline values in `project_budget_breakdowns`:

| Discipline | Maps to Division |
|------------|-----------------|
| ELECTRICAL | I&E |
| INSTRUMENTATION | I&E |
| INSTRUMENTATION DEMO | I&E |
| CIVIL - GROUNDING | Civil |
| GROUTING | Civil |
| FABRICATION | Mechanical (or new Fabrication division) |
| PIPING | Mechanical |
| PIPING DEMO | Mechanical |
| EQUIPMENT | Mechanical |
| EQUIPMENT DEMO | Mechanical |
| STEEL | Mechanical |
| STEEL DEMO | Mechanical |
| SCAFFOLDING | Mechanical |
| BUILDING-REMODELING | Mechanical |
| CONSTRUCTABILITY | Mechanical |
| GENERAL STAFFING | Mechanical |

### 2. Craft Type to Division Mapping
Craft types can be associated with divisions based on their typical work:
- Electricians → I&E
- Instrumentation Tech → I&E
- Civil/Concrete workers → Civil
- Pipefitters, Boilermakers, Millwrights → Mechanical
- Management/Support roles → Can work across divisions

### 3. Purchase Order Division Assignment
POs will be linked to divisions through the `created_by` user's division assignment.

## Schema Modifications

### Phase 1: Core Division Support Tables

#### 1. Create `project_divisions` Junction Table
```sql
CREATE TABLE project_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  division_id uuid NOT NULL REFERENCES divisions(id),
  division_pm_id uuid REFERENCES profiles(id),
  is_lead_division boolean DEFAULT false,
  budget_allocated numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, division_id)
);

-- Ensure at least one lead division per project
CREATE UNIQUE INDEX idx_one_lead_division_per_project 
ON project_divisions(project_id) 
WHERE is_lead_division = true;
```

#### 2. Create `division_discipline_mapping` Table
```sql
CREATE TABLE division_discipline_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id),
  discipline_name varchar NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(discipline_name)
);
```

#### 3. Create `craft_type_divisions` Table
```sql
CREATE TABLE craft_type_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  craft_type_id uuid NOT NULL REFERENCES craft_types(id),
  division_id uuid NOT NULL REFERENCES divisions(id),
  is_primary boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(craft_type_id, division_id)
);
```

### Phase 2: Add Division Support to Cost Tracking Tables

#### 1. Modify `purchase_orders`
```sql
ALTER TABLE purchase_orders 
ADD COLUMN division_id uuid REFERENCES divisions(id);

-- Populate based on created_by user's division
UPDATE purchase_orders po
SET division_id = p.division_id
FROM profiles p
WHERE po.created_by = p.id;
```

#### 2. Modify `change_orders`
```sql
ALTER TABLE change_orders 
ADD COLUMN division_id uuid REFERENCES divisions(id);
```

#### 3. Modify `labor_actuals`
```sql
ALTER TABLE labor_actuals 
ADD COLUMN division_id uuid REFERENCES divisions(id);

-- Populate based on craft_type mapping
UPDATE labor_actuals la
SET division_id = ctd.division_id
FROM craft_type_divisions ctd
WHERE la.craft_type_id = ctd.craft_type_id
AND ctd.is_primary = true;
```

#### 4. Modify `labor_headcount_forecasts`
```sql
ALTER TABLE labor_headcount_forecasts 
ADD COLUMN division_id uuid REFERENCES divisions(id);
```

#### 5. Modify `invoices`
```sql
ALTER TABLE invoices 
ADD COLUMN division_id uuid REFERENCES divisions(id);
```

### Phase 3: Enhanced Financial Tracking

#### 1. Create `division_budgets` Table
```sql
CREATE TABLE division_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  division_id uuid NOT NULL REFERENCES divisions(id),
  labor_budget numeric DEFAULT 0,
  materials_budget numeric DEFAULT 0,
  equipment_budget numeric DEFAULT 0,
  subcontracts_budget numeric DEFAULT 0,
  other_budget numeric DEFAULT 0,
  total_budget numeric GENERATED ALWAYS AS (
    COALESCE(labor_budget, 0) + 
    COALESCE(materials_budget, 0) + 
    COALESCE(equipment_budget, 0) + 
    COALESCE(subcontracts_budget, 0) + 
    COALESCE(other_budget, 0)
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, division_id)
);
```

#### 2. Create `division_forecasts` Table
```sql
CREATE TABLE division_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  division_id uuid NOT NULL REFERENCES divisions(id),
  forecast_date date NOT NULL,
  forecasted_cost numeric DEFAULT 0,
  cost_to_complete numeric DEFAULT 0,
  percent_complete numeric DEFAULT 0,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, division_id, forecast_date)
);
```

### Phase 4: Aggregation and Rollup Support

#### 1. Create Materialized View for Division Costs
```sql
CREATE MATERIALIZED VIEW division_cost_summary AS
SELECT 
  p.id as project_id,
  d.id as division_id,
  d.name as division_name,
  -- PO Costs
  COALESCE(SUM(po.total_amount), 0) as total_po_committed,
  COALESCE(SUM(po.invoiced_amount), 0) as total_po_invoiced,
  -- Labor Costs
  COALESCE(SUM(la.actual_cost_with_burden), 0) as total_labor_cost,
  COALESCE(SUM(la.actual_hours), 0) as total_labor_hours,
  -- Change Orders
  COALESCE(SUM(CASE WHEN co.status = 'approved' THEN co.amount ELSE 0 END), 0) as approved_change_orders,
  -- Last updated
  GREATEST(
    MAX(po.updated_at),
    MAX(la.updated_at),
    MAX(co.updated_at)
  ) as last_updated
FROM projects p
CROSS JOIN divisions d
LEFT JOIN purchase_orders po ON po.project_id = p.id AND po.division_id = d.id
LEFT JOIN labor_actuals la ON la.project_id = p.id AND la.division_id = d.id
LEFT JOIN change_orders co ON co.project_id = p.id AND co.division_id = d.id
GROUP BY p.id, d.id, d.name;

CREATE INDEX idx_division_cost_summary ON division_cost_summary(project_id, division_id);
```

#### 2. Create Trigger Functions for Automatic Rollups
```sql
CREATE OR REPLACE FUNCTION update_project_totals_from_divisions()
RETURNS TRIGGER AS $$
BEGIN
  -- Update project totals based on division totals
  UPDATE projects p
  SET 
    revised_contract = (
      SELECT COALESCE(SUM(db.total_budget), 0)
      FROM division_budgets db
      WHERE db.project_id = p.id
    ),
    updated_at = now()
  WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
CREATE TRIGGER update_project_on_division_budget_change
AFTER INSERT OR UPDATE OR DELETE ON division_budgets
FOR EACH ROW EXECUTE FUNCTION update_project_totals_from_divisions();
```

### Phase 5: Row Level Security Updates

#### 1. Division-based Access for POs
```sql
CREATE POLICY division_po_access ON purchase_orders
FOR ALL USING (
  -- Controllers and executives see all
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE role IN ('controller', 'executive')
  )
  OR
  -- Division managers see their division's POs
  (
    division_id IN (
      SELECT division_id FROM profiles 
      WHERE id = auth.uid() AND role = 'ops_manager'
    )
  )
  OR
  -- Project managers see their project's POs
  project_id IN (
    SELECT project_id FROM project_divisions
    WHERE division_pm_id = auth.uid()
  )
);
```

#### 2. Similar policies for other cost tracking tables
Apply similar RLS policies to:
- change_orders
- labor_actuals
- labor_headcount_forecasts
- invoices
- division_budgets
- division_forecasts

## Migration Strategy

### Step 1: Data Preparation
1. Create division mapping tables
2. Populate discipline to division mappings
3. Map craft types to divisions
4. Ensure all active users have division assignments

### Step 2: Schema Migration
1. Add division_id columns to cost tracking tables
2. Create junction and support tables
3. Populate division_id based on mappings
4. Create indexes and constraints

### Step 3: Data Migration
1. For existing projects, create project_divisions entries
2. Set current division as lead division
3. Migrate budget breakdowns to division budgets
4. Update financial snapshots

### Step 4: Validation
1. Verify all cost data has division assignments
2. Check rollup calculations match current totals
3. Test RLS policies with different user roles
4. Validate division-based reporting

## Benefits

1. **Granular Tracking**: Track costs and budgets by division
2. **Better Accountability**: Division PMs responsible for their budgets
3. **Improved Reporting**: Division-level P&L and performance metrics
4. **Flexible Structure**: Projects can have 1-N divisions
5. **Historical Compatibility**: Existing single-division projects continue to work
6. **Scalability**: Easy to add new divisions or reassign work