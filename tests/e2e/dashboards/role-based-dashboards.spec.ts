import { test, expect } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

test.describe('Role-Based Dashboards', () => {
  test.describe('Controller Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/dashboard/controller')
      await page.waitForSelector('[data-testid="controller-dashboard"]')
    })

    test('should display full company overview', async ({ page }) => {
      // Verify key metrics cards
      await expect(page.locator('[data-testid="total-projects-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-revenue-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-costs-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="profit-margin-card"]')).toBeVisible()
      
      // Verify charts
      await expect(page.locator('[data-testid="revenue-trend-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-performance-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="project-status-chart"]')).toBeVisible()
    })

    test('should have access to all administrative functions', async ({ page }) => {
      // Verify admin menu items
      await expect(page.locator('[data-testid="create-user-button"]')).toBeVisible()
      await expect(page.locator('[data-testid="manage-divisions-button"]')).toBeVisible()
      await expect(page.locator('[data-testid="system-settings-button"]')).toBeVisible()
      await expect(page.locator('[data-testid="audit-log-button"]')).toBeVisible()
    })

    test('should show alerts and notifications', async ({ page }) => {
      // Check alerts section
      await expect(page.locator('[data-testid="alerts-section"]')).toBeVisible()
      
      // Verify different alert types
      const alerts = page.locator('[data-testid="alert-item"]')
      const alertCount = await alerts.count()
      
      if (alertCount > 0) {
        // Check first alert has required elements
        const firstAlert = alerts.first()
        await expect(firstAlert.locator('[data-testid="alert-severity"]')).toBeVisible()
        await expect(firstAlert.locator('[data-testid="alert-message"]')).toBeVisible()
        await expect(firstAlert.locator('[data-testid="alert-timestamp"]')).toBeVisible()
      }
    })

    test('should navigate to detailed reports', async ({ page }) => {
      // Click on revenue trend for details
      await page.click('[data-testid="revenue-trend-chart"]')
      await page.waitForSelector('[data-testid="detailed-revenue-report"]')
      
      // Verify detailed report elements
      await expect(page.locator('[data-testid="revenue-by-month-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="revenue-by-division-breakdown"]')).toBeVisible()
      await expect(page.locator('[data-testid="export-report-button"]')).toBeVisible()
    })

    test('should manage user accounts', async ({ page }) => {
      // Click create user
      await page.click('[data-testid="create-user-button"]')
      await page.waitForSelector('[data-testid="create-user-modal"]')
      
      // Fill user form
      await page.fill('input[name="email"]', `testuser${Date.now()}@ics.ac`)
      await page.fill('input[name="first_name"]', 'Test')
      await page.fill('input[name="last_name"]', 'User')
      await page.selectOption('select[name="role"]', 'viewer')
      
      // Verify all role options are available
      const roleOptions = await page.locator('select[name="role"] option').allTextContents()
      expect(roleOptions).toContain('Controller')
      expect(roleOptions).toContain('Executive')
      expect(roleOptions).toContain('Ops Manager')
      expect(roleOptions).toContain('Project Manager')
      expect(roleOptions).toContain('Accounting')
      expect(roleOptions).toContain('Viewer')
    })
  })

  test.describe('Executive Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'executive')
      await page.goto('/dashboard/executive')
      await page.waitForSelector('[data-testid="executive-dashboard"]')
    })

    test('should display high-level KPIs only', async ({ page }) => {
      // Verify executive KPIs
      await expect(page.locator('[data-testid="revenue-ytd"]')).toBeVisible()
      await expect(page.locator('[data-testid="profit-ytd"]')).toBeVisible()
      await expect(page.locator('[data-testid="margin-percentage"]')).toBeVisible()
      await expect(page.locator('[data-testid="backlog-amount"]')).toBeVisible()
      
      // Should not show detailed operational data
      await expect(page.locator('[data-testid="po-details"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="labor-details"]')).not.toBeVisible()
    })

    test('should show strategic visualizations', async ({ page }) => {
      // Verify executive charts
      await expect(page.locator('[data-testid="revenue-forecast-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-profitability-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="market-segment-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="pipeline-chart"]')).toBeVisible()
    })

    test('should access executive reports', async ({ page }) => {
      // Click on reports menu
      await page.click('[data-testid="executive-reports-menu"]')
      
      // Verify report options
      await expect(page.locator('[data-testid="quarterly-report-link"]')).toBeVisible()
      await expect(page.locator('[data-testid="annual-report-link"]')).toBeVisible()
      await expect(page.locator('[data-testid="board-deck-link"]')).toBeVisible()
    })

    test('should not have access to operational functions', async ({ page }) => {
      // Verify no access to detailed operations
      await expect(page.locator('[data-testid="create-po-button"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="enter-labor-button"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="manage-users-button"]')).not.toBeVisible()
    })
  })

  test.describe('Ops Manager Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'ops_manager')
      await page.goto('/dashboard/ops-manager')
      await page.waitForSelector('[data-testid="ops-manager-dashboard"]')
    })

    test('should display division-specific data only', async ({ page }) => {
      // Verify division header
      const divisionName = await page.locator('[data-testid="division-header"]').textContent()
      expect(divisionName).toContain('Division')
      
      // Verify division metrics
      await expect(page.locator('[data-testid="division-projects-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-revenue"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-costs"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-margin"]')).toBeVisible()
    })

    test('should show division project list', async ({ page }) => {
      // Check projects table
      await expect(page.locator('[data-testid="division-projects-table"]')).toBeVisible()
      
      // Verify all projects belong to the division
      const projectRows = page.locator('[data-testid="project-row"]')
      const count = await projectRows.count()
      
      for (let i = 0; i < count; i++) {
        const division = await projectRows.nth(i).locator('[data-testid="project-division"]').textContent()
        expect(division).toBe(await page.locator('[data-testid="division-header"]').textContent())
      }
    })

    test('should access division-level reports', async ({ page }) => {
      // Click on division reports
      await page.click('[data-testid="division-reports-button"]')
      
      // Verify report types
      await expect(page.locator('[data-testid="division-performance-report"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-forecast-report"]')).toBeVisible()
      await expect(page.locator('[data-testid="division-labor-report"]')).toBeVisible()
    })

    test('should not see other divisions data', async ({ page }) => {
      // Try to navigate to another division (should fail)
      const currentUrl = page.url()
      await page.goto('/divisions/other-division/dashboard')
      
      // Should redirect back or show error
      await expect(page).toHaveURL(currentUrl)
    })
  })

  test.describe('Project Manager Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'project_manager')
      await page.goto('/dashboard/project-manager')
      await page.waitForSelector('[data-testid="project-manager-dashboard"]')
    })

    test('should display assigned projects only', async ({ page }) => {
      // Verify projects section
      await expect(page.locator('[data-testid="my-projects-section"]')).toBeVisible()
      
      // Check project cards
      const projectCards = page.locator('[data-testid="project-card"]')
      const count = await projectCards.count()
      expect(count).toBeGreaterThan(0)
      
      // Verify project card contents
      const firstCard = projectCards.first()
      await expect(firstCard.locator('[data-testid="project-name"]')).toBeVisible()
      await expect(firstCard.locator('[data-testid="project-status"]')).toBeVisible()
      await expect(firstCard.locator('[data-testid="project-progress"]')).toBeVisible()
      await expect(firstCard.locator('[data-testid="project-budget-status"]')).toBeVisible()
    })

    test('should show PM-specific alerts', async ({ page }) => {
      // Check PM alerts
      await expect(page.locator('[data-testid="pm-alerts"]')).toBeVisible()
      
      // Verify alert types
      const alertTypes = [
        'pending-change-orders',
        'budget-warnings',
        'schedule-alerts',
        'pending-approvals'
      ]
      
      for (const type of alertTypes) {
        const alert = page.locator(`[data-testid="alert-${type}"]`)
        if (await alert.isVisible()) {
          await expect(alert.locator('[data-testid="alert-count"]')).toBeVisible()
        }
      }
    })

    test('should access project quick actions', async ({ page }) => {
      // Verify quick action buttons
      await expect(page.locator('[data-testid="create-co-quick"]')).toBeVisible()
      await expect(page.locator('[data-testid="enter-labor-quick"]')).toBeVisible()
      await expect(page.locator('[data-testid="update-forecast-quick"]')).toBeVisible()
      
      // Test quick action
      await page.click('[data-testid="create-co-quick"]')
      await page.waitForSelector('[data-testid="change-order-form"]')
      
      // Should pre-select a project
      const selectedProject = await page.locator('select[name="project_id"]').inputValue()
      expect(selectedProject).toBeTruthy()
    })

    test('should not see unassigned projects', async ({ page }) => {
      // Get PM's project count
      const myProjectsCount = await page.locator('[data-testid="project-card"]').count()
      
      // Navigate to all projects
      await page.goto('/projects')
      
      // Total projects should be more than assigned projects
      const allProjectsCount = await page.locator('[data-testid="project-row"]').count()
      expect(allProjectsCount).toBeGreaterThanOrEqual(myProjectsCount)
    })
  })

  test.describe('Accounting Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'accounting')
      await page.goto('/dashboard/accounting')
      await page.waitForSelector('[data-testid="accounting-dashboard"]')
    })

    test('should display financial overview', async ({ page }) => {
      // Verify accounting metrics
      await expect(page.locator('[data-testid="total-receivables"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-payables"]')).toBeVisible()
      await expect(page.locator('[data-testid="cash-position"]')).toBeVisible()
      await expect(page.locator('[data-testid="working-capital"]')).toBeVisible()
    })

    test('should show pending approvals', async ({ page }) => {
      // Check pending items section
      await expect(page.locator('[data-testid="pending-invoices"]')).toBeVisible()
      await expect(page.locator('[data-testid="pending-payments"]')).toBeVisible()
      await expect(page.locator('[data-testid="pending-change-orders"]')).toBeVisible()
      
      // Verify action buttons
      const pendingInvoices = page.locator('[data-testid="pending-invoice-item"]')
      if (await pendingInvoices.count() > 0) {
        const firstInvoice = pendingInvoices.first()
        await expect(firstInvoice.locator('[data-testid="approve-invoice-button"]')).toBeVisible()
        await expect(firstInvoice.locator('[data-testid="reject-invoice-button"]')).toBeVisible()
      }
    })

    test('should access financial reports', async ({ page }) => {
      // Click on reports section
      await page.click('[data-testid="financial-reports-menu"]')
      
      // Verify report options
      await expect(page.locator('[data-testid="ar-aging-report"]')).toBeVisible()
      await expect(page.locator('[data-testid="ap-aging-report"]')).toBeVisible()
      await expect(page.locator('[data-testid="cash-flow-report"]')).toBeVisible()
      await expect(page.locator('[data-testid="wip-report"]')).toBeVisible()
    })

    test('should process invoices', async ({ page }) => {
      // Click on pending invoice
      const pendingInvoices = page.locator('[data-testid="pending-invoice-item"]')
      if (await pendingInvoices.count() > 0) {
        await pendingInvoices.first().click()
        await page.waitForSelector('[data-testid="invoice-detail-modal"]')
        
        // Verify invoice details
        await expect(page.locator('[data-testid="invoice-number"]')).toBeVisible()
        await expect(page.locator('[data-testid="invoice-amount"]')).toBeVisible()
        await expect(page.locator('[data-testid="invoice-vendor"]')).toBeVisible()
        await expect(page.locator('[data-testid="invoice-po-reference"]')).toBeVisible()
        
        // Process invoice
        await page.fill('textarea[name="approval_notes"]', 'Verified against PO')
        await page.click('button:has-text("Approve for Payment")')
        
        await expect(page.locator('.toast-success')).toBeVisible()
      }
    })
  })

  test.describe('Viewer Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'viewer')
      await page.goto('/dashboard/viewer')
      await page.waitForSelector('[data-testid="viewer-dashboard"]')
    })

    test('should display read-only information', async ({ page }) => {
      // Verify read-only badge
      await expect(page.locator('[data-testid="read-only-badge"]')).toBeVisible()
      
      // Verify basic metrics are visible
      await expect(page.locator('[data-testid="projects-overview"]')).toBeVisible()
      await expect(page.locator('[data-testid="company-metrics"]')).toBeVisible()
    })

    test('should not have any action buttons', async ({ page }) => {
      // Verify no create/edit buttons
      await expect(page.locator('button:has-text("Create")')).not.toBeVisible()
      await expect(page.locator('button:has-text("Edit")')).not.toBeVisible()
      await expect(page.locator('button:has-text("Delete")')).not.toBeVisible()
      await expect(page.locator('button:has-text("Approve")')).not.toBeVisible()
    })

    test('should access view-only reports', async ({ page }) => {
      // Click on reports
      await page.click('[data-testid="viewer-reports-menu"]')
      
      // Verify only view options
      await expect(page.locator('[data-testid="view-project-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="view-summary-report"]')).toBeVisible()
      
      // Should not have export options
      await expect(page.locator('[data-testid="export-button"]')).not.toBeVisible()
    })

    test('should navigate but not modify', async ({ page }) => {
      // Navigate to a project
      await page.goto('/projects')
      await page.click('[data-testid="project-row"]')
      
      // Verify view mode
      await expect(page.locator('[data-testid="view-mode-indicator"]')).toBeVisible()
      
      // No edit buttons
      await expect(page.locator('button:has-text("Edit Project")')).not.toBeVisible()
      await expect(page.locator('button:has-text("Delete Project")')).not.toBeVisible()
    })
  })

  test.describe('Dashboard Performance', () => {
    test('should load dashboards within acceptable time', async ({ page }) => {
      const roles = ['controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer']
      
      for (const role of roles) {
        await setupAuthState(page, role)
        
        const startTime = Date.now()
        await page.goto(`/dashboard/${role.replace('_', '-')}`)
        await page.waitForSelector(`[data-testid="${role.replace('_', '-')}-dashboard"]`)
        const loadTime = Date.now() - startTime
        
        // Dashboard should load within 3 seconds
        expect(loadTime).toBeLessThan(3000)
        
        // Logout for next iteration
        await page.click('[data-testid="user-menu"]')
        await page.click('button:has-text("Logout")')
      }
    })

    test('should handle real-time updates', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/dashboard/controller')
      
      // Get initial project count
      const initialCount = await page.locator('[data-testid="total-projects-value"]').textContent()
      
      // Open new tab and create a project
      const newPage = await page.context().newPage()
      await setupAuthState(newPage, 'controller')
      await newPage.goto('/projects/new')
      
      await newPage.fill('input[name="job_number"]', `TEST-RT-${Date.now()}`)
      await newPage.fill('input[name="name"]', 'Real-time Test Project')
      await newPage.selectOption('select[name="client_id"]', { index: 1 })
      await newPage.selectOption('select[name="division_id"]', { index: 1 })
      await newPage.fill('input[name="city"]', 'Test City')
      await newPage.fill('input[name="state"]', 'CA')
      await newPage.fill('input[name="original_contract_amount"]', '1000000')
      await newPage.click('button[type="submit"]')
      
      await newPage.waitForSelector('.toast-success')
      
      // Check if dashboard updated
      await page.waitForTimeout(2000) // Wait for real-time update
      const updatedCount = await page.locator('[data-testid="total-projects-value"]').textContent()
      
      expect(parseInt(updatedCount || '0')).toBe(parseInt(initialCount || '0') + 1)
      
      await newPage.close()
    })
  })
})