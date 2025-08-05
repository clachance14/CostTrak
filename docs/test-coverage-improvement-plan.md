# Test Coverage Improvement Plan for CostTrak

## Current State Analysis

### Test Coverage Gaps

Based on codebase analysis, the following critical areas lack adequate test coverage:

1. **Budget Import System** (`/lib/services/excel-budget-analyzer.ts`)
   - No tests for Excel parsing logic
   - No validation tests for different sheet types
   - Missing edge case handling tests

2. **Financial Calculations**
   - Budget vs actual calculations
   - Change order impact calculations
   - Labor burden calculations

3. **API Routes** (Most `/app/api/` endpoints lack tests)
   - CRUD operations for projects
   - Import endpoints
   - Authentication flows

4. **React Components**
   - Form components with complex validation
   - Data tables with sorting/filtering
   - Chart components

## Implementation Roadmap

### Phase 1: Critical Business Logic (Week 1-2)

Priority: **HIGH**

1. **Budget Import Tests**
   ```typescript
   // Tests to implement:
   - Excel file validation
   - Sheet type detection
   - Data extraction accuracy
   - Error handling for malformed files
   - WBS code generation
   ```

2. **Financial Calculation Tests**
   ```typescript
   // Tests to implement:
   - Revised contract calculations
   - Budget vs actual comparisons
   - Labor cost calculations with burden
   - Change order cumulative impacts
   ```

### Phase 2: API Route Testing (Week 3-4)

Priority: **HIGH**

1. **Project API Tests** (`/app/api/projects/`)
   ```typescript
   // Tests to implement:
   - GET /api/projects - list with filters
   - POST /api/projects - creation validation
   - PUT /api/projects/[id] - update operations
   - DELETE /api/projects/[id] - soft delete
   ```

2. **Import API Tests**
   ```typescript
   // Tests to implement:
   - POST /api/purchase-orders/import
   - POST /api/labor-import
   - POST /api/project-budgets/import-coversheet
   ```

### Phase 3: Component Testing (Week 5-6)

Priority: **MEDIUM**

1. **Form Components**
   - ProjectForm with validation
   - ChangeOrderForm with calculations
   - ImportPreview components

2. **Data Display Components**
   - BudgetBreakdownTable
   - POLogTable with sorting
   - LaborForecastTable

### Phase 4: E2E User Flows (Week 7-8)

Priority: **MEDIUM**

1. **Critical User Journeys**
   - Complete project creation flow
   - Budget import and review process
   - Weekly labor/PO import workflow
   - Change order approval process

## Test Implementation Guidelines

### Unit Test Template

```typescript
// lib/services/__tests__/budget-calculations.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { calculateRevisedContract, calculateBudgetVariance } from '../budget-calculations'

describe('Budget Calculations', () => {
  describe('calculateRevisedContract', () => {
    it('should calculate revised contract with approved change orders', () => {
      const originalContract = 1000000
      const changeOrders = [
        { amount: 50000, status: 'approved' },
        { amount: 25000, status: 'pending' }, // Should not be included
        { amount: 30000, status: 'approved' }
      ]
      
      const result = calculateRevisedContract(originalContract, changeOrders)
      expect(result).toBe(1080000)
    })

    it('should handle empty change orders', () => {
      const result = calculateRevisedContract(1000000, [])
      expect(result).toBe(1000000)
    })
  })
})
```

### E2E Test Template

```typescript
// tests/e2e/budget-import.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsProjectManager } from '../helpers/auth'

test.describe('Budget Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsProjectManager(page)
  })

  test('should import budget from Excel template', async ({ page }) => {
    // Navigate to project
    await page.goto('/projects/test-project-id/overview')
    
    // Click import budget
    await page.click('button:has-text("Import Budget")')
    
    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./tests/fixtures/valid-budget.xlsx')
    
    // Verify preview
    await expect(page.locator('h2:has-text("Import Preview")')).toBeVisible()
    
    // Confirm import
    await page.click('button:has-text("Confirm Import")')
    
    // Verify success
    await expect(page.locator('text=Budget imported successfully')).toBeVisible()
  })
})
```

## Metrics and Goals

### Coverage Targets by Q2 2025

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| Business Logic | ~5% | 90% | HIGH |
| API Routes | ~10% | 80% | HIGH |
| UI Components | ~15% | 70% | MEDIUM |
| Utilities | ~20% | 100% | HIGH |
| E2E Flows | ~30% | 60% | MEDIUM |

### Success Metrics

1. **Code Coverage**: Achieve 70% overall test coverage
2. **Test Execution Time**: Keep test suite under 5 minutes
3. **Flakiness**: Less than 1% flaky tests
4. **Bug Detection**: 80% of bugs caught by tests before production

## Tools and Resources

### Testing Tools
- **Vitest**: Unit and integration tests
- **Playwright**: E2E browser tests
- **MSW**: API mocking for tests
- **Testing Library**: React component testing

### Coverage Reporting
```bash
# Generate coverage report
pnpm test:coverage

# View coverage in browser
pnpm test:coverage --ui
```

### CI/CD Integration
- Run tests on every PR
- Block merges if coverage drops below threshold
- Generate coverage badges for README

## Next Steps

1. **Week 1**: Set up coverage reporting and CI integration
2. **Week 2**: Start with budget import tests (highest risk area)
3. **Week 3**: Add API route tests for critical endpoints
4. **Week 4**: Review progress and adjust priorities

## Resources for Claude Code

When implementing tests with Claude, use these prompts:

```
"Write comprehensive unit tests for the budget import service, including edge cases and error scenarios"

"Create E2E tests for the complete project creation flow, from form submission to database verification"

"Generate test fixtures for the labor import feature that cover all employee types and craft categories"
```

Remember to always run tests before committing:
```bash
pnpm lint && pnpm type-check && pnpm test:run
```