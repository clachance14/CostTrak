# WBS Parser Enhancement - Migration Guide

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This guide provides step-by-step instructions for migrating from the existing 3-level WBS structure to the enhanced 5-level hierarchy. It covers data migration, backwards compatibility, and rollback procedures.

## Migration Overview

### Current State (3-Level)
```
Level 1: Project
Level 2: Discipline/Category
Level 3: Line Items
```

### Target State (5-Level)
```
Level 1: Project (1.0)
Level 2: Construction Phase (1.1)
Level 3: Major Groups (1.1.X)
Level 4: Cost Categories (1.1.X.Y)
Level 5: Line Items (1.1.X.Y.Z)
```

## Pre-Migration Checklist

### 1. System Requirements
- [ ] Node.js 18+ installed
- [ ] TypeScript 5.x available
- [ ] Supabase CLI updated to latest version
- [ ] Database backup completed
- [ ] All tests passing on current version

### 2. Data Preparation
- [ ] Export current WBS structure
- [ ] Identify custom disciplines
- [ ] Document current budget totals
- [ ] Note any custom validation rules
- [ ] List active projects using budgets

### 3. Access Requirements
- [ ] Database admin access
- [ ] Supabase service role key
- [ ] Production deployment permissions
- [ ] Rollback plan approved

## Migration Steps

### Step 1: Database Schema Updates

#### 1.1 Create Migration File

Create a new migration file:
```bash
supabase migration new add_5_level_wbs_support
```

#### 1.2 Schema Updates

```sql
-- Add new columns to wbs_structure
ALTER TABLE public.wbs_structure
ADD COLUMN IF NOT EXISTS phase VARCHAR,
ADD COLUMN IF NOT EXISTS cost_type VARCHAR CHECK (cost_type IN ('DL', 'IL', 'MAT', 'EQ', 'SUB')),
ADD COLUMN IF NOT EXISTS labor_category_id UUID REFERENCES labor_categories(id),
ADD COLUMN IF NOT EXISTS legacy_code VARCHAR; -- Store old 3-level code

-- Update level constraint
ALTER TABLE public.wbs_structure
DROP CONSTRAINT IF EXISTS check_level,
ADD CONSTRAINT check_level CHECK (level BETWEEN 1 AND 5);

-- Create new tables for 5-level support
CREATE TABLE IF NOT EXISTS public.phase_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase VARCHAR NOT NULL CHECK (phase IN ('JOB_SET_UP', 'PRE_WORK', 'PROJECT_EXECUTION', 'JOB_CLOSE_OUT')),
  role VARCHAR NOT NULL,
  fte DECIMAL(5,2) NOT NULL,
  duration_months INTEGER NOT NULL,
  monthly_rate DECIMAL(10,2) NOT NULL,
  perdiem DECIMAL(10,2),
  add_ons DECIMAL(10,2),
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (
    fte * duration_months * (monthly_rate + COALESCE(perdiem, 0) + COALESCE(add_ons, 0))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discipline_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  parent_group VARCHAR NOT NULL,
  wbs_code_prefix VARCHAR(10),
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.labor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type VARCHAR CHECK (category_type IN ('DIRECT', 'INDIRECT')),
  name VARCHAR NOT NULL,
  code VARCHAR(10) UNIQUE,
  standard_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wbs_structure_phase ON public.wbs_structure(phase);
CREATE INDEX IF NOT EXISTS idx_wbs_structure_cost_type ON public.wbs_structure(cost_type);
CREATE INDEX IF NOT EXISTS idx_phase_allocations_project_phase ON public.phase_allocations(project_id, phase);

-- Add column to budget_line_items
ALTER TABLE public.budget_line_items
ADD COLUMN IF NOT EXISTS phase VARCHAR,
ADD COLUMN IF NOT EXISTS labor_category VARCHAR,
ADD COLUMN IF NOT EXISTS is_add_on BOOLEAN DEFAULT false;
```

#### 1.3 Seed Reference Data

```sql
-- Seed labor categories
INSERT INTO public.labor_categories (category_type, name, code) VALUES
-- Direct Labor (39 categories)
('DIRECT', 'Boiler Maker - Class A', 'DL001'),
('DIRECT', 'Boiler Maker - Class B', 'DL002'),
('DIRECT', 'Carpenter - Class A', 'DL003'),
('DIRECT', 'Carpenter - Class B', 'DL004'),
-- ... (add all 39)

-- Indirect Labor (23 roles)
('INDIRECT', 'Area Superintendent', 'IL001'),
('INDIRECT', 'Clerk', 'IL002'),
('INDIRECT', 'Cost Engineer', 'IL003'),
-- ... (add all 23)
ON CONFLICT (code) DO NOTHING;

-- Seed standard disciplines
INSERT INTO public.discipline_registry (name, parent_group, wbs_code_prefix, is_standard) VALUES
('PIPING', 'MECHANICAL', '09', true),
('STEEL', 'MECHANICAL', '09', true),
('EQUIPMENT', 'MECHANICAL', '09', true),
('INSTRUMENTATION', 'I&E', '10', true),
('ELECTRICAL', 'I&E', '10', true),
('CIVIL', 'CIVIL', '08', true),
('CONCRETE', 'CIVIL', '08', true),
-- ... (add all standard disciplines)
ON CONFLICT (name) DO NOTHING;
```

### Step 2: Data Migration Script

#### 2.1 Create Migration Script

```typescript
// scripts/migrate-3-to-5-level-wbs.ts
import { createClient } from '@supabase/supabase-js'
import { WBSMigrator } from '@/lib/services/wbs-migrator'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrate() {
  console.log('Starting WBS migration from 3-level to 5-level...')
  
  // Get all projects with budgets
  const { data: projects } = await supabase
    .from('projects')
    .select('id, job_number, name')
    .not('budget_total', 'is', null)
  
  if (!projects) {
    console.error('No projects found')
    return
  }
  
  console.log(`Found ${projects.length} projects to migrate`)
  
  const migrator = new WBSMigrator(supabase)
  
  for (const project of projects) {
    console.log(`\nMigrating project: ${project.job_number} - ${project.name}`)
    
    try {
      const result = await migrator.migrateProject(project.id)
      
      console.log(`✓ Migrated successfully:`)
      console.log(`  - WBS nodes: ${result.nodesCreated}`)
      console.log(`  - Line items updated: ${result.itemsUpdated}`)
      console.log(`  - New disciplines: ${result.newDisciplines.join(', ')}`)
      
    } catch (error) {
      console.error(`✗ Failed to migrate project ${project.id}:`, error)
    }
  }
  
  console.log('\nMigration complete!')
}

migrate().catch(console.error)
```

#### 2.2 WBS Migrator Implementation

```typescript
// lib/services/wbs-migrator.ts
export class WBSMigrator {
  constructor(private supabase: SupabaseClient) {}
  
  async migrateProject(projectId: string): Promise<MigrationResult> {
    // Start transaction
    const result: MigrationResult = {
      projectId,
      nodesCreated: 0,
      itemsUpdated: 0,
      newDisciplines: [],
      errors: []
    }
    
    try {
      // 1. Backup existing structure
      await this.backupExistingStructure(projectId)
      
      // 2. Get existing 3-level nodes
      const existingNodes = await this.getExistingNodes(projectId)
      
      // 3. Transform to 5-level structure
      const newNodes = await this.transformTo5Level(existingNodes)
      
      // 4. Create new WBS nodes
      await this.createNewNodes(projectId, newNodes)
      result.nodesCreated = newNodes.length
      
      // 5. Update budget line items
      const updatedItems = await this.updateLineItems(projectId)
      result.itemsUpdated = updatedItems
      
      // 6. Create phase allocations
      await this.createPhaseAllocations(projectId)
      
      // 7. Validate migration
      await this.validateMigration(projectId)
      
      return result
      
    } catch (error) {
      // Rollback on error
      await this.rollbackMigration(projectId)
      throw error
    }
  }
  
  private async transformTo5Level(nodes: WBSNode3Level[]): Promise<WBSNode5Level[]> {
    const transformed: WBSNode5Level[] = []
    
    // Create Level 1: Project Total
    transformed.push({
      code: '1.0',
      level: 1,
      description: 'Project Total',
      budget_total: nodes.reduce((sum, n) => sum + n.budget_total, 0)
    })
    
    // Create Level 2: Construction Phase
    transformed.push({
      code: '1.1',
      parent_code: '1.0',
      level: 2,
      description: 'Construction Phase',
      budget_total: nodes.reduce((sum, n) => sum + n.budget_total, 0)
    })
    
    // Map existing disciplines to Level 3 groups
    const disciplineGroups = this.mapDisciplinesToGroups(nodes)
    
    for (const [groupName, disciplines] of Object.entries(disciplineGroups)) {
      const groupCode = this.getGroupCode(groupName)
      
      // Create Level 3: Major Group
      transformed.push({
        code: groupCode,
        parent_code: '1.1',
        level: 3,
        description: groupName,
        budget_total: disciplines.reduce((sum, d) => sum + d.total, 0)
      })
      
      // Create Level 4: Categories
      for (const discipline of disciplines) {
        const categories = this.getCategoriesForDiscipline(discipline)
        
        for (const category of categories) {
          const categoryCode = `${groupCode}.${category.index}`
          
          transformed.push({
            code: categoryCode,
            parent_code: groupCode,
            level: 4,
            description: category.name,
            cost_type: category.type,
            budget_total: category.total
          })
          
          // Create Level 5: Line Items
          if (category.lineItems) {
            for (const item of category.lineItems) {
              transformed.push({
                code: `${categoryCode}.${item.index}`,
                parent_code: categoryCode,
                level: 5,
                description: item.description,
                budget_total: item.total
              })
            }
          }
        }
      }
    }
    
    return transformed
  }
}
```

### Step 3: Application Code Updates

#### 3.1 Update ExcelBudgetAnalyzer

```typescript
// lib/services/excel-budget-analyzer.ts
export class ExcelBudgetAnalyzer {
  private useFiveLevel: boolean = true
  
  constructor(options?: { useFiveLevel?: boolean }) {
    this.useFiveLevel = options?.useFiveLevel ?? true
  }
  
  async extractBudgetData(workbook: XLSX.WorkBook): Promise<ExcelBudgetData> {
    if (this.useFiveLevel) {
      return this.extract5LevelBudget(workbook)
    } else {
      // Backwards compatibility
      return this.extract3LevelBudget(workbook)
    }
  }
}
```

#### 3.2 Update Import UI

```typescript
// app/(dashboard)/projects/[id]/budget-import/page.tsx
export default function BudgetImportPage() {
  const [wbsLevel, setWbsLevel] = useState<3 | 5>(5)
  
  return (
    <div>
      {/* Add toggle for WBS level */}
      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={wbsLevel === 5}
            onChange={(e) => setWbsLevel(e.target.checked ? 5 : 3)}
          />
          Use 5-level WBS structure (recommended)
        </label>
      </div>
      
      {/* Rest of import UI */}
    </div>
  )
}
```

### Step 4: Testing the Migration

#### 4.1 Test on Staging

```bash
# Run migration on staging database
npm run migrate:staging

# Verify results
npm run verify:migration
```

#### 4.2 Verification Script

```typescript
// scripts/verify-migration.ts
async function verifyMigration() {
  const checks = [
    checkWBSLevels,
    checkBudgetTotals,
    checkPhaseAllocations,
    checkDisciplineMapping,
    check100Rule
  ]
  
  for (const check of checks) {
    const result = await check()
    console.log(`${result.passed ? '✓' : '✗'} ${result.name}: ${result.message}`)
  }
}
```

### Step 5: Production Deployment

#### 5.1 Deployment Steps

1. **Backup Production**
   ```bash
   supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Deploy Schema Changes**
   ```bash
   supabase db push
   ```

3. **Run Migration**
   ```bash
   NODE_ENV=production npm run migrate:production
   ```

4. **Verify Migration**
   ```bash
   NODE_ENV=production npm run verify:migration
   ```

#### 5.2 Monitoring

Monitor these metrics post-deployment:
- API response times
- Database query performance
- Import success rates
- User error reports

## Rollback Procedures

### Immediate Rollback (< 1 hour)

```sql
-- Restore from backup
BEGIN;

-- Remove 5-level specific data
DELETE FROM phase_allocations WHERE created_at > '2025-01-30';
DELETE FROM wbs_structure WHERE level > 3;

-- Restore 3-level codes
UPDATE wbs_structure 
SET code = legacy_code 
WHERE legacy_code IS NOT NULL;

-- Remove new columns
ALTER TABLE wbs_structure 
DROP COLUMN phase,
DROP COLUMN cost_type,
DROP COLUMN labor_category_id,
DROP COLUMN legacy_code;

COMMIT;
```

### Gradual Rollback

1. Enable 3-level mode in application
2. Export 5-level data
3. Transform back to 3-level
4. Import transformed data
5. Remove 5-level features

## Backwards Compatibility

### API Compatibility

The API maintains backwards compatibility:

```typescript
// Old endpoint still works
GET /api/projects/[id]/budget-import

// Returns 3-level by default for old clients
{
  "hierarchy": [...], // 3-level structure
  "useFiveLevel": false
}

// New clients can request 5-level
GET /api/projects/[id]/budget-import?wbsLevel=5
```

### Database Views

Create compatibility views:

```sql
-- 3-level view for legacy reports
CREATE VIEW wbs_structure_3level AS
SELECT 
  id,
  project_id,
  CASE 
    WHEN level <= 3 THEN code
    WHEN level = 4 THEN substring(code, 1, 5)  -- e.g., "1.1.3"
    WHEN level = 5 THEN substring(code, 1, 5)  -- map to level 3
  END as code,
  CASE 
    WHEN level <= 3 THEN level
    ELSE 3
  END as level,
  description,
  SUM(budget_total) as budget_total
FROM wbs_structure
GROUP BY 1, 2, 3, 4, 5;
```

## Common Issues & Solutions

### Issue 1: Discipline Mapping Conflicts

**Problem**: Custom disciplines don't map to standard groups

**Solution**:
```typescript
// Add custom mapping
const customMappings = {
  'CIVIL - GROUNDING': 'CIVIL',
  'SPECIAL EQUIPMENT': 'MECHANICAL'
}
```

### Issue 2: Budget Total Mismatches

**Problem**: 5-level totals don't match 3-level

**Solution**:
```sql
-- Reconciliation query
SELECT 
  p.job_number,
  old.total as old_total,
  new.total as new_total,
  ABS(old.total - new.total) as difference
FROM projects p
JOIN old_budget_totals old ON old.project_id = p.id
JOIN new_budget_totals new ON new.project_id = p.id
WHERE ABS(old.total - new.total) > 0.01;
```

### Issue 3: Performance Degradation

**Problem**: Queries slower with 5 levels

**Solution**:
```sql
-- Add materialized view
CREATE MATERIALIZED VIEW wbs_rollup_cache AS
SELECT 
  project_id,
  code,
  level,
  budget_total,
  (SELECT SUM(budget_total) 
   FROM wbs_structure c 
   WHERE c.code LIKE w.code || '.%') as children_total
FROM wbs_structure w;

-- Refresh periodically
REFRESH MATERIALIZED VIEW wbs_rollup_cache;
```

## Migration Timeline

### Week 1: Preparation
- Day 1-2: Database backups and staging setup
- Day 3-4: Migration script development
- Day 5: Staging deployment and testing

### Week 2: Execution
- Day 1: Production backup
- Day 2: Schema deployment
- Day 3: Data migration
- Day 4: Verification and monitoring
- Day 5: Issue resolution

## Success Criteria

Migration is successful when:

1. **Data Integrity**
   - [ ] All budget totals match pre-migration
   - [ ] No data loss detected
   - [ ] All projects accessible

2. **Functionality**
   - [ ] Import works for new files
   - [ ] Reports show correct data
   - [ ] No API errors

3. **Performance**
   - [ ] Query times within 10% of baseline
   - [ ] Import times acceptable
   - [ ] No timeout errors

4. **User Experience**
   - [ ] No user-reported issues
   - [ ] Training completed
   - [ ] Documentation updated

## Post-Migration Tasks

1. **Remove Legacy Code** (after 30 days)
   - Remove 3-level compatibility layer
   - Clean up legacy columns
   - Archive old documentation

2. **Optimize Performance**
   - Analyze query patterns
   - Add indexes as needed
   - Update materialized views

3. **Update Training Materials**
   - Record new import process
   - Update user guides
   - Create troubleshooting guide

## Support Contacts

- **Technical Issues**: dev-team@costtrak.com
- **Data Issues**: data-team@costtrak.com
- **User Support**: support@costtrak.com
- **Emergency**: +1-555-0123 (24/7)