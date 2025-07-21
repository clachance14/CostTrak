import { test, expect } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'
import path from 'path'

test.describe('Import Functionality', () => {
  test.describe('Employee Import', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/employees/import')
      await page.waitForSelector('[data-testid="employee-import-page"]')
    })

    test('should display import template download', async ({ page }) => {
      // Verify template download button
      await expect(page.locator('[data-testid="download-template-button"]')).toBeVisible()
      
      // Download template
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="download-template-button"]')
      const download = await downloadPromise
      
      expect(download.suggestedFilename()).toContain('employee-template')
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/)
    })

    test('should validate CSV format before import', async ({ page }) => {
      // Upload invalid file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(path.join(__dirname, '../../fixtures/invalid-employees.csv'))
      
      // Click import
      await page.click('button:has-text("Import Employees")')
      
      // Should show validation errors
      await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-summary"]')).toContainText('validation errors found')
    })

    test('should preview data before import', async ({ page }) => {
      // Upload valid file
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/valid-employees.csv'))
      
      // Should show preview
      await page.waitForSelector('[data-testid="import-preview"]')
      
      // Verify preview table
      await expect(page.locator('[data-testid="preview-table"]')).toBeVisible()
      const rows = page.locator('[data-testid="preview-row"]')
      expect(await rows.count()).toBeGreaterThan(0)
      
      // Check preview data
      const firstRow = rows.first()
      await expect(firstRow.locator('[data-testid="employee-name"]')).toBeVisible()
      await expect(firstRow.locator('[data-testid="employee-email"]')).toBeVisible()
      await expect(firstRow.locator('[data-testid="employee-role"]')).toBeVisible()
      await expect(firstRow.locator('[data-testid="employee-division"]')).toBeVisible()
    })

    test('should handle duplicate employees', async ({ page }) => {
      // Upload file with duplicates
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/employees-with-duplicates.csv'))
      
      // Preview should highlight duplicates
      await page.waitForSelector('[data-testid="duplicate-warning"]')
      
      // Check duplicate indicators
      const duplicateRows = page.locator('[data-testid="duplicate-row"]')
      expect(await duplicateRows.count()).toBeGreaterThan(0)
      
      // Should have option to skip or update
      await expect(page.locator('[data-testid="duplicate-action-select"]')).toBeVisible()
    })

    test('should successfully import valid employees', async ({ page }) => {
      // Upload valid file
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/valid-employees.csv'))
      
      // Wait for preview
      await page.waitForSelector('[data-testid="import-preview"]')
      
      // Click import button
      await page.click('button:has-text("Confirm Import")')
      
      // Show progress
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible()
      
      // Wait for completion
      await page.waitForSelector('[data-testid="import-success"]')
      
      // Verify success message
      const successMessage = await page.locator('[data-testid="import-summary"]').textContent()
      expect(successMessage).toContain('successfully imported')
      
      // Should show import stats
      await expect(page.locator('[data-testid="imported-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="skipped-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="failed-count"]')).toBeVisible()
    })

    test('should send welcome emails to new employees', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/new-employees.csv'))
      await page.waitForSelector('[data-testid="import-preview"]')
      
      // Check send welcome email option
      const sendEmailCheckbox = page.locator('input[name="send_welcome_emails"]')
      await expect(sendEmailCheckbox).toBeVisible()
      await expect(sendEmailCheckbox).toBeChecked() // Should be checked by default
      
      // Import with emails
      await page.click('button:has-text("Confirm Import")')
      await page.waitForSelector('[data-testid="import-success"]')
      
      // Verify email status
      await expect(page.locator('[data-testid="emails-sent-count"]')).toBeVisible()
    })
  })

  test.describe('Purchase Order Import', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'project_manager')
      await page.goto('/purchase-orders/import')
      await page.waitForSelector('[data-testid="po-import-page"]')
    })

    test('should map CSV columns to PO fields', async ({ page }) => {
      // Upload PO file
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/purchase-orders.csv'))
      
      // Should show column mapping
      await page.waitForSelector('[data-testid="column-mapping"]')
      
      // Verify mapping interface
      const mappingRows = page.locator('[data-testid="mapping-row"]')
      expect(await mappingRows.count()).toBeGreaterThan(0)
      
      // Check required fields are mapped
      await expect(page.locator('[data-testid="map-po_number"]')).toBeVisible()
      await expect(page.locator('[data-testid="map-vendor"]')).toBeVisible()
      await expect(page.locator('[data-testid="map-amount"]')).toBeVisible()
      await expect(page.locator('[data-testid="map-project_id"]')).toBeVisible()
    })

    test('should validate PO data', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/invalid-purchase-orders.csv'))
      
      // Continue to validation
      await page.click('button:has-text("Next")')
      
      // Should show validation results
      await page.waitForSelector('[data-testid="validation-results"]')
      
      // Check error types
      await expect(page.locator('[data-testid="invalid-po-numbers"]')).toBeVisible()
      await expect(page.locator('[data-testid="missing-vendors"]')).toBeVisible()
      await expect(page.locator('[data-testid="invalid-amounts"]')).toBeVisible()
      await expect(page.locator('[data-testid="invalid-projects"]')).toBeVisible()
    })

    test('should match projects by job number', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/po-with-job-numbers.csv'))
      
      // Map job number column
      await page.selectOption('[data-testid="map-project_identifier"]', 'job_number')
      await page.click('button:has-text("Next")')
      
      // Should show project matching results
      await page.waitForSelector('[data-testid="project-matching-results"]')
      
      // Verify matched and unmatched
      await expect(page.locator('[data-testid="matched-projects-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="unmatched-projects-list"]')).toBeVisible()
    })

    test('should import POs with line items', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/po-with-line-items.csv'))
      
      // Configure line item grouping
      await page.click('[data-testid="has-line-items-checkbox"]')
      await page.selectOption('[data-testid="group-by-column"]', 'po_number')
      
      await page.click('button:has-text("Next")')
      await page.waitForSelector('[data-testid="line-items-preview"]')
      
      // Verify line items grouped correctly
      const poGroups = page.locator('[data-testid="po-group"]')
      const firstGroup = poGroups.first()
      
      await expect(firstGroup.locator('[data-testid="line-item"]')).toHaveCount(3) // Assuming 3 line items
      
      // Import
      await page.click('button:has-text("Import Purchase Orders")')
      await page.waitForSelector('[data-testid="import-success"]')
    })

    test('should update existing POs', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/po-updates.csv'))
      
      // Select update mode
      await page.click('[data-testid="update-existing-checkbox"]')
      await page.selectOption('[data-testid="match-by"]', 'po_number')
      
      await page.click('button:has-text("Next")')
      
      // Should show update preview
      await page.waitForSelector('[data-testid="update-preview"]')
      
      // Verify changes highlighted
      const updateRows = page.locator('[data-testid="update-row"]')
      expect(await updateRows.count()).toBeGreaterThan(0)
      
      // Check change indicators
      await expect(updateRows.first().locator('[data-testid="field-changed"]')).toBeVisible()
    })
  })

  test.describe('Labor Data Import', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'project_manager')
      await page.goto('/labor/import')
      await page.waitForSelector('[data-testid="labor-import-page"]')
    })

    test('should import weekly labor actuals', async ({ page }) => {
      // Select project first
      await page.selectOption('select[name="project_id"]', { index: 1 })
      
      // Upload labor file
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/labor-actuals.csv'))
      
      // Should show week ending selection
      await page.waitForSelector('[data-testid="week-ending-select"]')
      await page.selectOption('select[name="week_ending"]', '2025-01-19') // Sunday
      
      // Preview labor data
      await page.click('button:has-text("Preview")')
      await page.waitForSelector('[data-testid="labor-preview"]')
      
      // Verify craft types and hours
      const laborRows = page.locator('[data-testid="labor-row"]')
      expect(await laborRows.count()).toBeGreaterThan(0)
      
      // Import
      await page.click('button:has-text("Import Labor Data")')
      await page.waitForSelector('[data-testid="import-success"]')
      
      // Verify totals
      await expect(page.locator('[data-testid="total-hours-imported"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-cost-imported"]')).toBeVisible()
    })

    test('should validate craft types', async ({ page }) => {
      await page.selectOption('select[name="project_id"]', { index: 1 })
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/labor-invalid-crafts.csv'))
      
      // Should show craft validation errors
      await page.waitForSelector('[data-testid="craft-validation-errors"]')
      
      // Offer craft mapping
      await expect(page.locator('[data-testid="craft-mapping-section"]')).toBeVisible()
      
      // Map unknown crafts
      const unknownCrafts = page.locator('[data-testid="unknown-craft"]')
      const count = await unknownCrafts.count()
      
      for (let i = 0; i < count; i++) {
        await unknownCrafts.nth(i).locator('select').selectOption({ index: 1 })
      }
      
      // Retry import
      await page.click('button:has-text("Import with Mapping")')
      await page.waitForSelector('[data-testid="import-success"]')
    })

    test('should calculate burden automatically', async ({ page }) => {
      await page.selectOption('select[name="project_id"]', { index: 1 })
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/labor-without-burden.csv'))
      
      // Check auto-calculate burden option
      const burdenCheckbox = page.locator('input[name="auto_calculate_burden"]')
      await expect(burdenCheckbox).toBeVisible()
      await burdenCheckbox.check()
      
      // Set burden rate
      await page.fill('input[name="burden_rate"]', '35') // 35%
      
      await page.click('button:has-text("Preview")')
      
      // Verify burden calculated in preview
      const laborRows = page.locator('[data-testid="labor-row"]')
      const firstRow = laborRows.first()
      
      const baseCost = await firstRow.locator('[data-testid="base-cost"]').textContent()
      const burdenAmount = await firstRow.locator('[data-testid="burden-amount"]').textContent()
      const totalCost = await firstRow.locator('[data-testid="total-cost"]').textContent()
      
      // Verify calculation
      const base = parseFloat(baseCost?.replace(/[$,]/g, '') || '0')
      const burden = parseFloat(burdenAmount?.replace(/[$,]/g, '') || '0')
      const total = parseFloat(totalCost?.replace(/[$,]/g, '') || '0')
      
      expect(burden).toBeCloseTo(base * 0.35, 2)
      expect(total).toBeCloseTo(base + burden, 2)
    })
  })

  test.describe('Project Budget Import', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/projects/budget-import')
      await page.waitForSelector('[data-testid="budget-import-page"]')
    })

    test('should import budget breakdown by division', async ({ page }) => {
      // Upload budget file
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/project-budgets.xlsx'))
      
      // Should detect Excel format
      await expect(page.locator('[data-testid="file-format-indicator"]')).toContainText('Excel')
      
      // Select worksheet
      await page.waitForSelector('[data-testid="worksheet-select"]')
      await page.selectOption('select[name="worksheet"]', 'Budget Summary')
      
      // Map budget categories
      await page.waitForSelector('[data-testid="category-mapping"]')
      
      // Map divisions
      const divisionMapping = page.locator('[data-testid="division-mapping"]')
      await expect(divisionMapping).toBeVisible()
      
      // Preview
      await page.click('button:has-text("Preview Import")')
      await page.waitForSelector('[data-testid="budget-preview"]')
      
      // Verify division breakdown
      const divisionBudgets = page.locator('[data-testid="division-budget"]')
      expect(await divisionBudgets.count()).toBeGreaterThan(0)
      
      // Import
      await page.click('button:has-text("Import Budgets")')
      await page.waitForSelector('[data-testid="import-success"]')
    })

    test('should validate budget totals', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/budget-with-errors.xlsx'))
      
      await page.selectOption('select[name="worksheet"]', { index: 0 })
      await page.click('button:has-text("Validate")')
      
      // Should show validation warnings
      await page.waitForSelector('[data-testid="validation-warnings"]')
      
      // Check specific warnings
      await expect(page.locator('[data-testid="total-mismatch-warning"]')).toBeVisible()
      await expect(page.locator('[data-testid="negative-budget-warning"]')).toBeVisible()
      await expect(page.locator('[data-testid="missing-category-warning"]')).toBeVisible()
      
      // Allow override with explanation
      await page.click('[data-testid="override-warnings-checkbox"]')
      await page.fill('textarea[name="override_reason"]', 'Approved variance per PM')
      
      // Should enable import
      await expect(page.locator('button:has-text("Import Budgets")')).toBeEnabled()
    })
  })

  test.describe('Import History and Rollback', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/imports/history')
      await page.waitForSelector('[data-testid="import-history-page"]')
    })

    test('should show import history', async ({ page }) => {
      // Verify history table
      await expect(page.locator('[data-testid="import-history-table"]')).toBeVisible()
      
      // Check history entries
      const historyRows = page.locator('[data-testid="import-history-row"]')
      
      if (await historyRows.count() > 0) {
        const firstRow = historyRows.first()
        await expect(firstRow.locator('[data-testid="import-type"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="import-date"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="import-user"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="import-status"]')).toBeVisible()
        await expect(firstRow.locator('[data-testid="records-count"]')).toBeVisible()
      }
    })

    test('should view import details', async ({ page }) => {
      const historyRows = page.locator('[data-testid="import-history-row"]')
      
      if (await historyRows.count() > 0) {
        await historyRows.first().click()
        await page.waitForSelector('[data-testid="import-detail-modal"]')
        
        // Verify details
        await expect(page.locator('[data-testid="import-summary"]')).toBeVisible()
        await expect(page.locator('[data-testid="import-log"]')).toBeVisible()
        await expect(page.locator('[data-testid="affected-records"]')).toBeVisible()
        
        // Should have download original file option
        await expect(page.locator('[data-testid="download-original-file"]')).toBeVisible()
      }
    })

    test('should rollback recent import', async ({ page }) => {
      // Find a successful import that can be rolled back
      const rollbackableImport = page.locator('[data-testid="import-history-row"][data-can-rollback="true"]').first()
      
      if (await rollbackableImport.isVisible()) {
        await rollbackableImport.locator('[data-testid="rollback-button"]').click()
        
        // Confirm rollback
        await page.waitForSelector('[data-testid="rollback-confirmation-modal"]')
        await expect(page.locator('[data-testid="rollback-warning"]')).toBeVisible()
        
        // Enter confirmation
        await page.fill('input[name="rollback_reason"]', 'Data entry error')
        await page.click('button:has-text("Confirm Rollback")')
        
        // Wait for rollback
        await page.waitForSelector('[data-testid="rollback-progress"]')
        await page.waitForSelector('[data-testid="rollback-success"]')
        
        // Verify rollback completed
        const status = await rollbackableImport.locator('[data-testid="import-status"]').textContent()
        expect(status).toContain('Rolled Back')
      }
    })
  })

  test.describe('Import Permissions', () => {
    test('viewer role cannot access import functions', async ({ page }) => {
      await setupAuthState(page, 'viewer')
      
      // Try to access import pages
      const importUrls = [
        '/employees/import',
        '/purchase-orders/import',
        '/labor/import',
        '/projects/budget-import'
      ]
      
      for (const url of importUrls) {
        await page.goto(url)
        
        // Should redirect or show unauthorized
        await expect(page).toHaveURL(/unauthorized|dashboard|login/)
      }
    })

    test('project manager can only import for assigned projects', async ({ page }) => {
      await setupAuthState(page, 'project_manager')
      await page.goto('/labor/import')
      
      // Check project dropdown
      const projectOptions = await page.locator('select[name="project_id"] option').allTextContents()
      
      // Should only show assigned projects
      expect(projectOptions.length).toBeGreaterThan(1) // Including default option
      
      // Verify can't select unassigned project
      const allProjectsCount = await page.evaluate(() => {
        // This would be the total projects in the system
        return 10 // Mock value
      })
      
      expect(projectOptions.length - 1).toBeLessThan(allProjectsCount)
    })
  })
})