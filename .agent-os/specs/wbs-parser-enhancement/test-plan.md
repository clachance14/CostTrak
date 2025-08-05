# WBS Parser Enhancement - Test Plan

**Version**: 1.0.0  
**Last Updated**: 2025-01-30

## Overview

This document outlines the comprehensive testing strategy for the WBS parser enhancement, covering unit tests, integration tests, performance testing, and user acceptance criteria.

## Testing Principles

1. **Test-Driven Development (TDD)**: Write failing tests first
2. **95% Code Coverage**: Minimum acceptable coverage
3. **Edge Case Focus**: Prioritize boundary conditions
4. **Performance Benchmarks**: Measure against SLAs
5. **Regression Prevention**: Maintain backwards compatibility

## Test Organization

```
tests/
├── unit/
│   ├── parsers/
│   │   ├── staff-parser.test.ts
│   │   ├── directs-parser.test.ts
│   │   ├── materials-parser.test.ts
│   │   ├── subs-parser.test.ts
│   │   ├── equipment-parser.test.ts
│   │   └── constructability-parser.test.ts
│   ├── services/
│   │   ├── excel-budget-analyzer.test.ts
│   │   ├── wbs-validator.test.ts
│   │   ├── wbs-builder.test.ts
│   │   └── discipline-mapper.test.ts
│   └── utils/
│       ├── truncation-handler.test.ts
│       └── numeric-parser.test.ts
├── integration/
│   ├── api/
│   │   ├── budget-import.test.ts
│   │   ├── wbs-hierarchy.test.ts
│   │   └── labor-categories.test.ts
│   ├── database/
│   │   ├── wbs-structure.test.ts
│   │   └── phase-allocations.test.ts
│   └── workflows/
│       └── full-import.test.ts
├── e2e/
│   ├── budget-import-flow.test.ts
│   └── wbs-navigation.test.ts
├── performance/
│   ├── large-file-import.test.ts
│   └── hierarchy-query.test.ts
└── fixtures/
    ├── excel-files/
    ├── mock-data/
    └── test-helpers/
```

## Unit Tests

### 1. Parser Tests

#### StaffParser Tests

```typescript
describe('StaffParser', () => {
  let parser: StaffParser

  beforeEach(() => {
    parser = new StaffParser()
  })

  describe('parse', () => {
    it('should parse all 23 indirect labor roles', async () => {
      const worksheet = createMockStaffSheet()
      const result = await parser.parse(worksheet)
      
      expect(result.roles).toHaveLength(23)
      expect(result.roles.map(r => r.name)).toEqual(
        expect.arrayContaining(INDIRECT_LABOR_ROLES)
      )
    })

    it('should parse all 4 phases correctly', async () => {
      const worksheet = createMockStaffSheet()
      const result = await parser.parse(worksheet)
      
      const phases = [...new Set(result.allocations.map(a => a.phase))]
      expect(phases).toEqual(['JOB_SET_UP', 'PRE_WORK', 'PROJECT_EXECUTION', 'JOB_CLOSE_OUT'])
    })

    it('should calculate FTE allocations correctly', async () => {
      const worksheet = createMockStaffSheet({
        'Project Manager': {
          'JOB_SET_UP': 1.0,
          'PRE_WORK': 1.0,
          'PROJECT_EXECUTION': 2.0,
          'JOB_CLOSE_OUT': 0.5
        }
      })
      
      const result = await parser.parse(worksheet)
      const pmAllocations = result.allocations.filter(a => a.role === 'Project Manager')
      
      expect(pmAllocations).toHaveLength(4)
      expect(pmAllocations[2].fte).toBe(2.0)
    })

    it('should handle empty cells as zero FTE', async () => {
      const worksheet = createMockStaffSheet({ sparse: true })
      const result = await parser.parse(worksheet)
      
      result.allocations.forEach(allocation => {
        expect(allocation.fte).toBeGreaterThanOrEqual(0)
      })
    })

    it('should calculate costs including perdiem and add-ons', async () => {
      const worksheet = createMockStaffSheet()
      const result = await parser.parse(worksheet)
      
      result.allocations.forEach(allocation => {
        const expectedCost = allocation.fte * allocation.duration_months * 
          (allocation.monthly_rate + (allocation.perdiem || 0) + (allocation.add_ons || 0))
        expect(allocation.total_cost).toBeCloseTo(expectedCost, 2)
      })
    })
  })
})
```

#### DirectsParser Tests

```typescript
describe('DirectsParser', () => {
  describe('parse', () => {
    it('should parse all 39 direct labor categories', async () => {
      const worksheet = createMockDirectsSheet()
      const result = await parser.parse(worksheet)
      
      const categories = [...new Set(result.items.map(i => i.category))]
      expect(categories).toHaveLength(39)
      expect(categories).toEqual(expect.arrayContaining(DIRECT_LABOR_CATEGORIES))
    })

    it('should map labor to correct disciplines', async () => {
      const worksheet = createMockDirectsSheet({
        disciplines: ['PIPING', 'STEEL', 'EQUIPMENT']
      })
      
      const result = await parser.parse(worksheet)
      const disciplines = [...new Set(result.items.map(i => i.discipline))]
      
      expect(disciplines).toEqual(['PIPING', 'STEEL', 'EQUIPMENT'])
    })

    it('should calculate manhours correctly', async () => {
      const worksheet = createMockDirectsSheet({
        'Welder - Class A': {
          'PIPING': 1000,
          'STEEL': 500
        }
      })
      
      const result = await parser.parse(worksheet)
      const welderHours = result.items
        .filter(i => i.category === 'Welder - Class A')
        .reduce((sum, i) => sum + i.manhours, 0)
      
      expect(welderHours).toBe(1500)
    })
  })
})
```

### 2. Service Tests

#### ExcelBudgetAnalyzer Tests

```typescript
describe('ExcelBudgetAnalyzer', () => {
  let analyzer: ExcelBudgetAnalyzer

  describe('extractBudgetData', () => {
    it('should build 5-level WBS hierarchy', async () => {
      const workbook = createMockWorkbook()
      const result = await analyzer.extractBudgetData(workbook)
      
      // Check all 5 levels exist
      const levels = new Set<number>()
      const traverse = (nodes: WBSNode[]) => {
        nodes.forEach(node => {
          levels.add(node.level)
          if (node.children.length > 0) traverse(node.children)
        })
      }
      traverse(result.wbsStructure)
      
      expect([...levels].sort()).toEqual([1, 2, 3, 4, 5])
    })

    it('should validate 100% rule', async () => {
      const workbook = createMockWorkbook()
      const result = await analyzer.extractBudgetData(workbook)
      
      // Level 1 should equal sum of Level 2
      const level1Total = result.wbsStructure[0].budget_total
      const level2Sum = result.wbsStructure[0].children
        .reduce((sum, child) => sum + child.budget_total, 0)
      
      expect(level2Sum).toBeCloseTo(level1Total, 2)
    })

    it('should handle truncated data gracefully', async () => {
      const workbook = createMockWorkbook({
        inclueTruncations: true
      })
      
      const result = await analyzer.extractBudgetData(workbook)
      
      expect(result.validation.warnings).toContainEqual(
        expect.objectContaining({
          code: 'TRUNCATED_DATA',
          message: expect.stringContaining('truncated')
        })
      )
    })

    it('should discover new disciplines dynamically', async () => {
      const workbook = createMockWorkbook({
        customDisciplines: ['CIVIL - GROUNDING', 'SPECIAL EQUIPMENT']
      })
      
      const result = await analyzer.extractBudgetData(workbook)
      const disciplines = result.summary.disciplines_discovered
      
      expect(disciplines).toContain('CIVIL - GROUNDING')
      expect(disciplines).toContain('SPECIAL EQUIPMENT')
    })
  })
})
```

### 3. Validation Tests

#### WBSValidator Tests

```typescript
describe('WBSValidator', () => {
  describe('validate100Rule', () => {
    it('should pass when children sum equals parent', () => {
      const hierarchy = createValidHierarchy()
      const result = validator.validate100Rule(hierarchy)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail when children sum exceeds tolerance', () => {
      const hierarchy = createInvalidHierarchy({
        parentTotal: 1000000,
        childrenSum: 1010000 // 1% over
      })
      
      const result = validator.validate100Rule(hierarchy)
      
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('RULE_100_VIOLATION')
    })

    it('should report specific nodes violating rule', () => {
      const hierarchy = createInvalidHierarchy()
      const result = validator.validate100Rule(hierarchy)
      
      expect(result.errors[0].location).toMatchObject({
        node_code: expect.any(String),
        level: expect.any(Number)
      })
    })
  })

  describe('validateCrossSheet', () => {
    it('should validate COVERSHEET totals match sum of sheets', () => {
      const data = createMockBudgetData()
      const result = validator.validateCrossSheet(data)
      
      expect(result.valid).toBe(true)
    })

    it('should detect discrepancies between sheets', () => {
      const data = createMockBudgetData({
        coversheetTotal: 1000000,
        actualTotal: 950000
      })
      
      const result = validator.validateCrossSheet(data)
      
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('50000')
    })
  })
})
```

## Integration Tests

### 1. API Integration Tests

```typescript
describe('Budget Import API', () => {
  let app: INestApplication
  let projectId: string

  beforeAll(async () => {
    app = await createTestApp()
    projectId = await createTestProject()
  })

  describe('POST /api/projects/:id/budget-import', () => {
    it('should import 5-level WBS successfully', async () => {
      const file = await readTestFile('valid-5-level-budget.xlsx')
      
      const response = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/budget-import`)
        .set('Authorization', `Bearer ${getTestToken()}`)
        .attach('file', file)
        .field('options[useFiveLevel]', 'true')
        .expect(200)
      
      expect(response.body).toMatchObject({
        success: true,
        summary: {
          wbs_nodes_created: expect.any(Number),
          line_items_created: expect.any(Number)
        },
        hierarchy: expect.arrayContaining([
          expect.objectContaining({
            level: 1,
            children: expect.any(Array)
          })
        ])
      })
    })

    it('should validate without importing when validateOnly=true', async () => {
      const file = await readTestFile('budget-with-errors.xlsx')
      
      const response = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/budget-import`)
        .attach('file', file)
        .field('options[validateOnly]', 'true')
        .expect(200)
      
      expect(response.body.summary.line_items_created).toBe(0)
      expect(response.body.validation.errors).not.toHaveLength(0)
    })

    it('should handle concurrent imports gracefully', async () => {
      const file = await readTestFile('large-budget.xlsx')
      
      // Start first import
      const promise1 = request(app.getHttpServer())
        .post(`/api/projects/${projectId}/budget-import`)
        .attach('file', file)
      
      // Attempt second import immediately
      const response2 = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/budget-import`)
        .attach('file', file)
        .expect(409)
      
      expect(response2.body.error.code).toBe('CONCURRENT_IMPORT')
      
      // Let first import complete
      await promise1
    })
  })
})
```

### 2. Database Integration Tests

```typescript
describe('WBS Structure Database', () => {
  describe('5-level hierarchy', () => {
    it('should store and retrieve complete hierarchy', async () => {
      const hierarchy = await createTestHierarchy(5)
      await saveHierarchy(projectId, hierarchy)
      
      const retrieved = await getHierarchy(projectId)
      
      expect(retrieved).toHaveLength(hierarchy.length)
      expect(retrieved).toEqual(
        expect.arrayContaining(
          hierarchy.map(node => expect.objectContaining({
            code: node.code,
            level: node.level
          }))
        )
      )
    })

    it('should maintain referential integrity', async () => {
      // Delete parent should cascade to children
      await deleteWBSNode(projectId, '1.1.1')
      
      const children = await getWBSChildren(projectId, '1.1.1')
      expect(children).toHaveLength(0)
    })

    it('should enforce unique codes per project', async () => {
      const duplicate = {
        project_id: projectId,
        code: '1.1.1',
        level: 3,
        description: 'Duplicate'
      }
      
      await expect(createWBSNode(duplicate)).rejects.toThrow(/unique/)
    })
  })
})
```

## End-to-End Tests

### Budget Import Flow

```typescript
describe('Budget Import E2E', () => {
  it('should complete full import workflow', async () => {
    // 1. Navigate to import page
    await page.goto(`/projects/${projectId}/budget-import`)
    
    // 2. Upload file
    const fileInput = await page.$('input[type="file"]')
    await fileInput.uploadFile('test-files/complete-budget.xlsx')
    
    // 3. Preview appears
    await page.waitForSelector('[data-testid="import-preview"]')
    
    // 4. Validate preview shows 5 levels
    const hierarchyPreview = await page.$('[data-testid="hierarchy-preview"]')
    const levels = await hierarchyPreview.$$('[data-level]')
    expect(levels).toHaveLength(5)
    
    // 5. Check validation status
    const validationStatus = await page.$('[data-testid="validation-status"]')
    const statusText = await validationStatus.innerText()
    expect(statusText).toContain('Valid')
    
    // 6. Import budget
    await page.click('[data-testid="import-button"]')
    
    // 7. Wait for success
    await page.waitForSelector('[data-testid="import-success"]', {
      timeout: 30000 // 30 seconds for large files
    })
    
    // 8. Verify redirect to budget view
    await page.waitForNavigation()
    expect(page.url()).toContain('/budget')
  })
})
```

## Performance Tests

### Large File Import

```typescript
describe('Performance: Large File Import', () => {
  const testCases = [
    { size: '1MB', expectedTime: 1000 },
    { size: '5MB', expectedTime: 3000 },
    { size: '10MB', expectedTime: 5000 },
    { size: '25MB', expectedTime: 15000 },
    { size: '50MB', expectedTime: 30000 }
  ]

  testCases.forEach(({ size, expectedTime }) => {
    it(`should import ${size} file within ${expectedTime}ms`, async () => {
      const file = await generateTestFile(size)
      const startTime = Date.now()
      
      await importBudget(projectId, file)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(expectedTime)
    })
  })

  it('should handle memory efficiently', async () => {
    const initialMemory = process.memoryUsage().heapUsed
    const file = await generateTestFile('50MB')
    
    await importBudget(projectId, file)
    
    // Force garbage collection
    if (global.gc) global.gc()
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory
    
    // Memory increase should be less than 2x file size
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB
  })
})
```

### Query Performance

```typescript
describe('Performance: WBS Queries', () => {
  beforeAll(async () => {
    // Create large hierarchy (10,000+ nodes)
    await createLargeTestHierarchy(projectId)
  })

  it('should retrieve full hierarchy in <100ms', async () => {
    const times = []
    
    // Run 10 times to get average
    for (let i = 0; i < 10; i++) {
      const start = performance.now()
      await getWBSHierarchy(projectId)
      times.push(performance.now() - start)
    }
    
    const avgTime = times.reduce((a, b) => a + b) / times.length
    expect(avgTime).toBeLessThan(100)
  })

  it('should filter by level efficiently', async () => {
    const start = performance.now()
    const level3Nodes = await getWBSHierarchy(projectId, { level: 3 })
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(50)
    expect(level3Nodes.every(n => n.level === 3)).toBe(true)
  })
})
```

## Test Data Management

### Mock Data Generators

```typescript
// Mock Excel file generator
export function createMockWorkbook(options: MockWorkbookOptions = {}) {
  const workbook = XLSX.utils.book_new()
  
  // Add sheets based on options
  if (options.includeStaff !== false) {
    const staffSheet = createStaffSheet(options.staffData)
    XLSX.utils.book_append_sheet(workbook, staffSheet, 'STAFF')
  }
  
  if (options.includeDirects !== false) {
    const directsSheet = createDirectsSheet(options.directsData)
    XLSX.utils.book_append_sheet(workbook, directsSheet, 'DIRECTS')
  }
  
  // Add more sheets...
  
  return workbook
}

// Test data factories
export const TestDataFactory = {
  wbsNode: (overrides?: Partial<WBSNode>): WBSNode => ({
    id: faker.datatype.uuid(),
    code: faker.random.alphaNumeric(6),
    level: faker.datatype.number({ min: 1, max: 5 }),
    description: faker.commerce.department(),
    budget_total: faker.datatype.number({ min: 1000, max: 1000000 }),
    children: [],
    ...overrides
  }),
  
  phaseAllocation: (overrides?: Partial<PhaseAllocation>): PhaseAllocation => ({
    phase: faker.helpers.arrayElement(['JOB_SET_UP', 'PRE_WORK', 'PROJECT_EXECUTION', 'JOB_CLOSE_OUT']),
    role: faker.helpers.arrayElement(INDIRECT_LABOR_ROLES),
    fte: faker.datatype.float({ min: 0.5, max: 2.0, precision: 0.5 }),
    duration_months: faker.datatype.number({ min: 1, max: 12 }),
    monthly_rate: faker.datatype.number({ min: 8000, max: 15000 }),
    ...overrides
  })
}
```

## Test Coverage Requirements

### Coverage Targets

| Component | Target | Critical Paths |
|-----------|--------|----------------|
| Parsers | 95% | All 39 labor categories, 23 roles |
| Services | 95% | 5-level hierarchy, validation |
| API | 90% | Import, hierarchy queries |
| Database | 85% | CRUD operations, constraints |
| UI | 80% | Import flow, preview |

### Coverage Report Configuration

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './lib/services/parsers/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/__mocks__/'
  ]
}
```

## Regression Testing

### Backwards Compatibility Tests

```typescript
describe('Backwards Compatibility', () => {
  it('should still support 3-level WBS import', async () => {
    const file = await readTestFile('legacy-3-level-budget.xlsx')
    
    const result = await importBudget(projectId, file, {
      useFiveLevel: false
    })
    
    expect(result.success).toBe(true)
    expect(Math.max(...result.hierarchy.map(n => n.level))).toBe(3)
  })

  it('should map legacy discipline names', async () => {
    const legacyDisciplines = ['PIPE', 'ELEC', 'INST']
    const file = createMockFile({ disciplines: legacyDisciplines })
    
    const result = await importBudget(projectId, file)
    
    expect(result.summary.disciplines_discovered).toEqual([
      'PIPING', 'ELECTRICAL', 'INSTRUMENTATION'
    ])
  })
})
```

## User Acceptance Testing

### UAT Scenarios

1. **Import Standard Budget**
   - User: Controller
   - File: Standard 5-sheet budget
   - Success: All data imported, hierarchy visible

2. **Import with Warnings**
   - User: Project Manager
   - File: Budget with truncations
   - Success: Import completes, warnings displayed

3. **Validate Complex Budget**
   - User: Controller
   - File: 15-sheet budget with custom disciplines
   - Success: Validation report accurate

4. **Query Labor Allocations**
   - User: Operations Manager
   - Action: View phase allocations
   - Success: All 23 roles × 4 phases visible

### UAT Checklist

- [ ] Import completes in reasonable time
- [ ] Preview shows accurate hierarchy
- [ ] Validation catches real errors
- [ ] Navigation through WBS levels works
- [ ] Labor reports match Excel totals
- [ ] Performance acceptable for large files
- [ ] Error messages are helpful
- [ ] No data loss or corruption

## Continuous Integration

### CI Pipeline Configuration

```yaml
# .github/workflows/wbs-parser-tests.yml
name: WBS Parser Tests

on:
  push:
    branches: [main, feature/wbs-parser-enhancement]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Run unit tests
      run: pnpm test:unit --coverage
      
    - name: Run integration tests
      run: pnpm test:integration
      
    - name: Run performance tests
      run: pnpm test:performance
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        fail_ci_if_error: true
        
    - name: Check coverage thresholds
      run: pnpm coverage:check
```

## Test Execution Plan

### Phase 1: Unit Tests (Days 1-2)
- Write parser tests
- Write service tests
- Achieve 95% coverage

### Phase 2: Integration Tests (Days 3-4)
- API endpoint tests
- Database integration
- Workflow tests

### Phase 3: Performance Tests (Day 5)
- Large file handling
- Query optimization
- Memory profiling

### Phase 4: E2E & UAT (Days 6-7)
- Full workflow tests
- User acceptance scenarios
- Cross-browser testing

## Success Metrics

1. **All tests passing**: 100% pass rate
2. **Coverage targets met**: ≥95% for critical paths
3. **Performance SLAs**: All benchmarks achieved
4. **No regressions**: Legacy features working
5. **UAT sign-off**: All scenarios approved