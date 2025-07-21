import { test, expect } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

test.describe('Financial Snapshots', () => {
  test.describe('Project-Level Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      // Login as controller who has full access
      await setupAuthState(page, 'controller')
    })

    test('should display current financial snapshot for project', async ({ page }) => {
      // Navigate to a project
      await page.goto('/projects')
      await page.waitForSelector('[data-testid="projects-list"]')
      
      // Click on first active project
      await page.click('[data-testid="project-row"][data-status="active"]')
      await page.waitForSelector('[data-testid="project-detail"]')
      
      // Navigate to financial snapshot tab
      await page.click('[data-testid="financial-tab"]')
      await page.waitForSelector('[data-testid="financial-snapshot"]')
      
      // Verify key financial metrics are displayed
      await expect(page.locator('[data-testid="original-contract"]')).toBeVisible()
      await expect(page.locator('[data-testid="approved-change-orders"]')).toBeVisible()
      await expect(page.locator('[data-testid="revised-contract"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-committed"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-costs-to-date"]')).toBeVisible()
      await expect(page.locator('[data-testid="forecasted-cost"]')).toBeVisible()
      await expect(page.locator('[data-testid="forecasted-profit"]')).toBeVisible()
      await expect(page.locator('[data-testid="profit-margin"]')).toBeVisible()
    })

    test('should calculate revised contract correctly', async ({ page }) => {
      await page.goto('/projects')
      await page.click('[data-testid="project-row"][data-status="active"]')
      await page.click('[data-testid="financial-tab"]')
      
      // Get values
      const originalContract = await getNumericValue(page, '[data-testid="original-contract"]')
      const changeOrders = await getNumericValue(page, '[data-testid="approved-change-orders"]')
      const revisedContract = await getNumericValue(page, '[data-testid="revised-contract"]')
      
      // Verify calculation
      expect(revisedContract).toBe(originalContract + changeOrders)
    })

    test('should show cost breakdown by category', async ({ page }) => {
      await page.goto('/projects')
      await page.click('[data-testid="project-row"][data-status="active"]')
      await page.click('[data-testid="financial-tab"]')
      
      // Check cost breakdown section
      await expect(page.locator('[data-testid="cost-breakdown"]')).toBeVisible()
      
      // Verify categories
      await expect(page.locator('[data-testid="labor-costs"]')).toBeVisible()
      await expect(page.locator('[data-testid="material-costs"]')).toBeVisible()
      await expect(page.locator('[data-testid="subcontractor-costs"]')).toBeVisible()
      await expect(page.locator('[data-testid="other-costs"]')).toBeVisible()
      
      // Verify total matches
      const laborCosts = await getNumericValue(page, '[data-testid="labor-costs"]')
      const materialCosts = await getNumericValue(page, '[data-testid="material-costs"]')
      const subcontractorCosts = await getNumericValue(page, '[data-testid="subcontractor-costs"]')
      const otherCosts = await getNumericValue(page, '[data-testid="other-costs"]')
      const totalCosts = await getNumericValue(page, '[data-testid="total-costs-to-date"]')
      
      expect(laborCosts + materialCosts + subcontractorCosts + otherCosts).toBeCloseTo(totalCosts, 2)
    })

    test('should update snapshot when financial data changes', async ({ page }) => {
      await page.goto('/projects')
      const projectRow = page.locator('[data-testid="project-row"][data-status="active"]').first()
      const projectId = await projectRow.getAttribute('data-project-id')
      await projectRow.click()
      
      // Get initial snapshot values
      await page.click('[data-testid="financial-tab"]')
      const initialForecastedCost = await getNumericValue(page, '[data-testid="forecasted-cost"]')
      
      // Add a new purchase order
      await page.click('[data-testid="purchase-orders-tab"]')
      await page.click('button:has-text("New Purchase Order")')
      
      await page.fill('input[name="po_number"]', `PO-TEST-${Date.now()}`)
      await page.fill('input[name="vendor"]', 'Test Vendor Inc')
      await page.fill('textarea[name="description"]', 'Additional materials')
      await page.fill('input[name="amount"]', '50000')
      await page.click('button[type="submit"]')
      
      await page.waitForSelector('.toast-success')
      
      // Go back to financial tab
      await page.click('[data-testid="financial-tab"]')
      
      // Force snapshot recalculation
      await page.click('button:has-text("Refresh Snapshot")')
      await page.waitForTimeout(2000) // Wait for calculation
      
      // Verify forecasted cost increased
      const updatedForecastedCost = await getNumericValue(page, '[data-testid="forecasted-cost"]')
      expect(updatedForecastedCost).toBeGreaterThan(initialForecastedCost)
    })
  })

  test.describe('Division-Level Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'ops_manager')
    })

    test('should show aggregated division snapshot', async ({ page }) => {
      await page.goto('/dashboard/ops-manager')
      await page.waitForSelector('[data-testid="division-snapshot"]')
      
      // Verify division-level metrics
      await expect(page.locator('[data-testid="division-total-contracts"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-total-committed"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-total-costs"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-forecasted-profit"]')).toBeVisible()
      
      // Verify project count
      const projectCount = await page.locator('[data-testid="division-project-count"]').textContent()
      expect(parseInt(projectCount || '0')).toBeGreaterThan(0)
    })

    test('should break down by project within division', async ({ page }) => {
      await page.goto('/dashboard/ops-manager')
      
      // Click on detailed view
      await page.click('button:has-text("View Details")')
      await page.waitForSelector('[data-testid="division-project-breakdown"]')
      
      // Verify project list
      const projectRows = page.locator('[data-testid="division-project-row"]')
      const count = await projectRows.count()
      expect(count).toBeGreaterThan(0)
      
      // Verify each project shows key metrics
      for (let i = 0; i < Math.min(count, 3); i++) {
        const row = projectRows.nth(i)
        await expect(row.locator('[data-testid="project-name"]')).toBeVisible()
        await expect(row.locator('[data-testid="project-contract"]')).toBeVisible()
        await expect(row.locator('[data-testid="project-profit-margin"]')).toBeVisible()
      }
    })

    test('ops manager should only see their division data', async ({ page }) => {
      await page.goto('/dashboard/ops-manager')
      
      // Check division name in header
      const divisionName = await page.locator('[data-testid="division-name"]').textContent()
      expect(divisionName).toBeTruthy()
      
      // Try to access another division's data (should fail)
      await page.goto('/divisions/other-division-id/snapshot')
      
      // Should redirect or show error
      await expect(page).toHaveURL(/unauthorized|dashboard/)
    })
  })

  test.describe('Company-Level Snapshots', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'executive')
    })

    test('should show company-wide financial snapshot', async ({ page }) => {
      await page.goto('/dashboard/executive')
      await page.waitForSelector('[data-testid="company-snapshot"]')
      
      // Verify company metrics
      await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-costs"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-profit"]')).toBeVisible()
      await expect(page.locator('[data-testid="overall-margin"]')).toBeVisible()
      
      // Verify division breakdown
      await expect(page.locator('[data-testid="division-breakdown-chart"]')).toBeVisible()
    })

    test('should show year-over-year comparison', async ({ page }) => {
      await page.goto('/dashboard/executive')
      
      // Click on YoY comparison
      await page.click('button:has-text("Year over Year")')
      await page.waitForSelector('[data-testid="yoy-comparison"]')
      
      // Verify comparison metrics
      await expect(page.locator('[data-testid="revenue-growth"]')).toBeVisible()
      await expect(page.locator('[data-testid="cost-growth"]')).toBeVisible()
      await expect(page.locator('[data-testid="margin-trend"]')).toBeVisible()
      
      // Check trend indicators
      const revenueGrowth = await page.locator('[data-testid="revenue-growth-indicator"]').getAttribute('data-trend')
      expect(['up', 'down', 'stable']).toContain(revenueGrowth)
    })

    test('should drill down to division details', async ({ page }) => {
      await page.goto('/dashboard/executive')
      
      // Click on a division in the chart
      await page.click('[data-testid="division-breakdown-chart"] [data-division]')
      
      // Should navigate to division detail
      await page.waitForSelector('[data-testid="division-detail-view"]')
      
      // Verify division details
      await expect(page.locator('[data-testid="division-projects-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-performance-metrics"]')).toBeVisible()
    })
  })

  test.describe('Historical Snapshots', () => {
    test('should view historical snapshots', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/projects')
      await page.click('[data-testid="project-row"][data-status="active"]')
      await page.click('[data-testid="financial-tab"]')
      
      // Click historical view
      await page.click('button:has-text("View History")')
      await page.waitForSelector('[data-testid="snapshot-history"]')
      
      // Verify historical data
      const historyRows = page.locator('[data-testid="history-row"]')
      expect(await historyRows.count()).toBeGreaterThan(0)
      
      // Check each row has date and key metrics
      const firstRow = historyRows.first()
      await expect(firstRow.locator('[data-testid="snapshot-date"]')).toBeVisible()
      await expect(firstRow.locator('[data-testid="historical-contract"]')).toBeVisible()
      await expect(firstRow.locator('[data-testid="historical-costs"]')).toBeVisible()
      await expect(firstRow.locator('[data-testid="historical-profit"]')).toBeVisible()
    })

    test('should compare snapshots over time', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/projects')
      await page.click('[data-testid="project-row"][data-status="active"]')
      await page.click('[data-testid="financial-tab"]')
      
      // Select comparison mode
      await page.click('button:has-text("Compare Snapshots")')
      
      // Select two dates
      await page.click('[data-testid="from-date"]')
      await page.click('[data-testid="calendar-day"]')
      
      await page.click('[data-testid="to-date"]')
      await page.click('[data-testid="calendar-day"]')
      
      await page.click('button:has-text("Compare")')
      
      // Verify comparison view
      await page.waitForSelector('[data-testid="snapshot-comparison"]')
      await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible()
      
      // Check variance calculations
      await expect(page.locator('[data-testid="contract-variance"]')).toBeVisible()
      await expect(page.locator('[data-testid="cost-variance"]')).toBeVisible()
      await expect(page.locator('[data-testid="profit-variance"]')).toBeVisible()
    })
  })

  test.describe('Snapshot Accuracy', () => {
    test('should accurately calculate labor costs', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/projects')
      await page.click('[data-testid="project-row"][data-status="active"]')
      
      // Add labor actuals
      await page.click('[data-testid="labor-tab"]')
      await page.click('button:has-text("Enter Weekly Actuals")')
      
      const laborEntries = [
        { craft: 'Carpenter', hours: 160, cost: 8000 },
        { craft: 'Electrician', hours: 80, cost: 5600 },
        { craft: 'Plumber', hours: 40, cost: 3200 }
      ]
      
      let totalLaborCost = 0
      for (const entry of laborEntries) {
        await page.fill(`input[data-craft="${entry.craft}"][name="hours"]`, entry.hours.toString())
        await page.fill(`input[data-craft="${entry.craft}"][name="cost"]`, entry.cost.toString())
        totalLaborCost += entry.cost
      }
      
      await page.click('button[type="submit"]')
      await page.waitForSelector('.toast-success')
      
      // Check financial snapshot
      await page.click('[data-testid="financial-tab"]')
      
      const snapshotLaborCost = await getNumericValue(page, '[data-testid="labor-costs"]')
      expect(snapshotLaborCost).toBeGreaterThanOrEqual(totalLaborCost)
    })

    test('should include all cost components in total', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/projects')
      await page.click('[data-testid="project-row"][data-status="active"]')
      await page.click('[data-testid="financial-tab"]')
      
      // Get all cost components
      const components = {
        labor: await getNumericValue(page, '[data-testid="labor-costs"]'),
        materials: await getNumericValue(page, '[data-testid="material-costs"]'),
        subcontractor: await getNumericValue(page, '[data-testid="subcontractor-costs"]'),
        other: await getNumericValue(page, '[data-testid="other-costs"]')
      }
      
      const calculatedTotal = Object.values(components).reduce((sum, val) => sum + val, 0)
      const displayedTotal = await getNumericValue(page, '[data-testid="total-costs-to-date"]')
      
      // Allow small rounding difference
      expect(Math.abs(calculatedTotal - displayedTotal)).toBeLessThan(1)
    })
  })

  // Helper function to extract numeric value from currency display
  async function getNumericValue(page: any, selector: string): Promise<number> {
    const text = await page.locator(selector).textContent()
    return parseFloat(text?.replace(/[$,]/g, '') || '0')
  }
})