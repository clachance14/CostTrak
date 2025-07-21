import { test, expect } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

test.describe('Labor Forecast Entry', () => {
  let projectId: string

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await setupAuthState(page)
    
    // Navigate to projects and select first one
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    // Click on first project
    const firstProject = page.locator('[data-testid="project-row"]').first()
    await firstProject.click()
    
    // Extract project ID from URL
    await page.waitForURL(/\/projects\/([\w-]+)/)
    projectId = page.url().split('/projects/')[1].split('/')[0]
    
    // Navigate to labor forecasts tab
    await page.click('a:has-text("Labor"), button:has-text("Labor")')
    await page.waitForLoadState('networkidle')
  })

  test('should display labor forecast interface', async ({ page }) => {
    // Check for labor page elements
    await expect(page.locator('h2:has-text("Labor")')).toBeVisible()
    
    // Should have week selector
    await expect(page.locator('[data-testid="week-selector"], input[type="week"]')).toBeVisible()
    
    // Should show craft types
    await expect(page.locator('text="Direct"')).toBeVisible()
    await expect(page.locator('text="Indirect"')).toBeVisible()
    await expect(page.locator('text="Staff"')).toBeVisible()
  })

  test('should enter weekly actual labor costs', async ({ page }) => {
    // Select current week
    const currentWeek = new Date().toISOString().slice(0, 10)
    const weekInput = page.locator('[data-testid="week-selector"], input[type="week"]')
    await weekInput.fill(currentWeek)
    
    // Enter actual costs for each craft type
    const laborData = {
      direct: {
        hours: '480',
        cost: '24000'
      },
      indirect: {
        hours: '160',
        cost: '7200'
      },
      staff: {
        hours: '80',
        cost: '6400'
      }
    }
    
    // Fill Direct labor
    await page.fill('[data-testid="direct-hours"], input[name="direct_hours"]', laborData.direct.hours)
    await page.fill('[data-testid="direct-cost"], input[name="direct_cost"]', laborData.direct.cost)
    
    // Fill Indirect labor
    await page.fill('[data-testid="indirect-hours"], input[name="indirect_hours"]', laborData.indirect.hours)
    await page.fill('[data-testid="indirect-cost"], input[name="indirect_cost"]', laborData.indirect.cost)
    
    // Fill Staff labor
    await page.fill('[data-testid="staff-hours"], input[name="staff_hours"]', laborData.staff.hours)
    await page.fill('[data-testid="staff-cost"], input[name="staff_cost"]', laborData.staff.cost)
    
    // Save actuals
    await page.click('button:has-text("Save")')
    
    // Verify save was successful
    await expect(page.locator('text="Labor actuals saved"')).toBeVisible()
    
    // Verify running averages are calculated
    await expect(page.locator('[data-testid="direct-avg-rate"]')).toContainText('$50')
    await expect(page.locator('[data-testid="indirect-avg-rate"]')).toContainText('$45')
    await expect(page.locator('[data-testid="staff-avg-rate"]')).toContainText('$80')
  })

  test('should update headcount projections', async ({ page }) => {
    // Switch to forecast/projection view
    await page.click('button:has-text("Projections"), a:has-text("Projections")')
    
    // Wait for projections interface
    await page.waitForSelector('[data-testid="headcount-projections"]')
    
    // Select a future week
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    const futureWeek = futureDate.toISOString().slice(0, 10)
    
    await page.fill('[data-testid="forecast-week"], input[name="forecast_week"]', futureWeek)
    
    // Enter headcount projections
    const headcountData = {
      direct: '12',
      indirect: '4',
      staff: '2'
    }
    
    await page.fill('[data-testid="direct-headcount"], input[name="direct_headcount"]', headcountData.direct)
    await page.fill('[data-testid="indirect-headcount"], input[name="indirect_headcount"]', headcountData.indirect)
    await page.fill('[data-testid="staff-headcount"], input[name="staff_headcount"]', headcountData.staff)
    
    // Save projections
    await page.click('button:has-text("Save Projections")')
    
    // Verify projections were saved
    await expect(page.locator('text="Projections saved"')).toBeVisible()
    
    // Verify calculated forecast amounts
    await expect(page.locator('[data-testid="direct-forecast-amount"]')).toBeVisible()
    await expect(page.locator('[data-testid="indirect-forecast-amount"]')).toBeVisible()
    await expect(page.locator('[data-testid="staff-forecast-amount"]')).toBeVisible()
  })

  test('should view labor analytics dashboard', async ({ page }) => {
    // Navigate to analytics view
    await page.click('button:has-text("Analytics"), a:has-text("Analytics")')
    
    // Wait for analytics to load
    await page.waitForSelector('[data-testid="labor-analytics"]')
    
    // Check for key analytics components
    await expect(page.locator('text="Labor Cost Trends"')).toBeVisible()
    await expect(page.locator('text="Headcount Projections"')).toBeVisible()
    await expect(page.locator('text="Average Rates by Craft"')).toBeVisible()
    
    // Check for chart elements
    await expect(page.locator('[data-testid="cost-trend-chart"], canvas')).toBeVisible()
    await expect(page.locator('[data-testid="headcount-chart"], canvas')).toBeVisible()
    
    // Check for summary metrics
    await expect(page.locator('[data-testid="total-labor-cost"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-labor-hours"]')).toBeVisible()
    await expect(page.locator('[data-testid="avg-hourly-rate"]')).toBeVisible()
  })

  test('should compare actual vs forecast labor', async ({ page }) => {
    // Navigate to comparison view if available
    const comparisonTab = page.locator('button:has-text("Comparison"), a:has-text("Comparison")')
    
    if (await comparisonTab.isVisible()) {
      await comparisonTab.click()
      
      // Wait for comparison data
      await page.waitForSelector('[data-testid="labor-comparison"]')
      
      // Check for variance calculations
      await expect(page.locator('[data-testid="cost-variance"]')).toBeVisible()
      await expect(page.locator('[data-testid="hours-variance"]')).toBeVisible()
      await expect(page.locator('[data-testid="headcount-variance"]')).toBeVisible()
      
      // Check for variance alerts
      const varianceAlerts = page.locator('[data-testid="variance-alert"]')
      if (await varianceAlerts.count() > 0) {
        // Verify alerts show for significant variances
        await expect(varianceAlerts.first()).toBeVisible()
      }
    }
  })

  test('should export labor data', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("Export")')
    
    if (await exportButton.isVisible()) {
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download')
      
      // Click export
      await exportButton.click()
      
      // Select export format if dialog appears
      const formatDialog = page.locator('[role="dialog"]:has-text("Export")')
      if (await formatDialog.isVisible()) {
        await page.click('button:has-text("Excel"), button:has-text("CSV")')
      }
      
      // Wait for download to start
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/labor.*\.(xlsx|csv)/)
    }
  })
})