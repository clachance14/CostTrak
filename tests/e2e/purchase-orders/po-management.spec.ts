import { test, expect } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

test.describe('Purchase Order Management', () => {
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
    
    // Navigate to purchase orders tab
    await page.click('a:has-text("Purchase Orders"), button:has-text("Purchase Orders")')
    await page.waitForLoadState('networkidle')
  })

  test('should display purchase orders list', async ({ page }) => {
    // Check for PO page elements
    await expect(page.locator('h2:has-text("Purchase Orders")')).toBeVisible()
    
    // Should have import button
    await expect(page.locator('button:has-text("Import")')).toBeVisible()
    
    // Should have create button
    await expect(page.locator('button:has-text("Create")')).toBeVisible()
    
    // Should show PO table or empty state
    const poTable = page.locator('[data-testid="po-table"]')
    const emptyState = page.locator('text="No purchase orders found"')
    
    await expect(poTable.or(emptyState)).toBeVisible()
  })

  test('should create a new purchase order', async ({ page }) => {
    // Click create button
    await page.click('button:has-text("Create")')
    
    // Wait for form
    await page.waitForSelector('form')
    
    // Fill PO details
    const timestamp = Date.now()
    const poData = {
      po_number: `PO-TEST-${timestamp}`,
      vendor_name: 'Test Vendor Inc',
      description: 'E2E Test Purchase Order',
      amount: '50000',
      status: 'Approved',
    }
    
    // Fill form fields
    await page.fill('input[name="po_number"]', poData.po_number)
    await page.fill('input[name="vendor_name"]', poData.vendor_name)
    await page.fill('textarea[name="description"], input[name="description"]', poData.description)
    await page.fill('input[name="amount"]', poData.amount)
    
    // Select status if dropdown exists
    const statusSelect = page.locator('select[name="status"]')
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption(poData.status)
    }
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for success
    await page.waitForLoadState('networkidle')
    
    // Verify PO was created
    await expect(page.locator(`text="${poData.po_number}"`)).toBeVisible()
    await expect(page.locator(`text="${poData.vendor_name}"`)).toBeVisible()
  })

  test('should add line items to purchase order', async ({ page }) => {
    // Click on first PO in list
    const firstPO = page.locator('[data-testid="po-row"]').first()
    
    if (await firstPO.count() > 0) {
      await firstPO.click()
      
      // Wait for PO detail view
      await page.waitForSelector('[data-testid="po-details"]')
      
      // Click add line item button
      await page.click('button:has-text("Add Line Item")')
      
      // Fill line item details
      const lineItemData = {
        description: 'Test Line Item',
        quantity: '10',
        unit_price: '100',
        total: '1000',
      }
      
      await page.fill('input[name="line_item_description"]', lineItemData.description)
      await page.fill('input[name="quantity"]', lineItemData.quantity)
      await page.fill('input[name="unit_price"]', lineItemData.unit_price)
      
      // Submit line item
      await page.click('button:has-text("Add")')
      
      // Verify line item was added
      await expect(page.locator(`text="${lineItemData.description}"`)).toBeVisible()
    }
  })

  test('should import purchase orders from CSV', async ({ page }) => {
    // Click import button
    await page.click('button:has-text("Import")')
    
    // Wait for import dialog
    await page.waitForSelector('[data-testid="import-dialog"], [role="dialog"]')
    
    // Create a sample CSV file
    const csvContent = `PO Number,Vendor,Description,Amount,Status
PO-IMP-001,Import Vendor 1,Imported PO 1,25000,Approved
PO-IMP-002,Import Vendor 2,Imported PO 2,35000,Pending`
    
    // Set file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Click import/upload button
    await page.click('button:has-text("Upload"), button:has-text("Import")')
    
    // Wait for import to complete
    await page.waitForLoadState('networkidle')
    
    // Verify imported POs appear
    await expect(page.locator('text="Import successful"')).toBeVisible()
    await expect(page.locator('text="PO-IMP-001"')).toBeVisible()
  })

  test('should filter purchase orders', async ({ page }) => {
    // Check if there are any POs to filter
    const poRows = page.locator('[data-testid="po-row"]')
    
    if (await poRows.count() > 0) {
      // Filter by status
      const statusFilter = page.locator('select[name="status-filter"], [data-testid="status-filter"]')
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('Approved')
        await page.waitForTimeout(500)
        
        // Verify filtered results
        const filteredRows = page.locator('[data-testid="po-row"]')
        const count = await filteredRows.count()
        
        for (let i = 0; i < count; i++) {
          const statusText = await filteredRows.nth(i).locator('[data-testid="po-status"]').textContent()
          expect(statusText).toContain('Approved')
        }
      }
      
      // Search by vendor
      const searchInput = page.locator('input[placeholder*="Search"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('Test Vendor')
        await page.waitForTimeout(500)
        
        // Verify search results
        const searchResults = page.locator('[data-testid="po-row"]')
        const searchCount = await searchResults.count()
        
        if (searchCount > 0) {
          for (let i = 0; i < searchCount; i++) {
            const vendorText = await searchResults.nth(i).textContent()
            expect(vendorText?.toLowerCase()).toContain('test vendor')
          }
        }
      }
    }
  })

  test('should update purchase order forecast', async ({ page }) => {
    // Click on first PO
    const firstPO = page.locator('[data-testid="po-row"]').first()
    
    if (await firstPO.count() > 0) {
      await firstPO.click()
      
      // Wait for PO details
      await page.waitForSelector('[data-testid="po-details"]')
      
      // Click edit forecast button
      await page.click('button:has-text("Edit Forecast"), button:has-text("Update Forecast")')
      
      // Update forecast amount
      const forecastInput = page.locator('input[name="forecast_amount"]')
      await forecastInput.clear()
      await forecastInput.fill('75000')
      
      // Save forecast
      await page.click('button:has-text("Save")')
      
      // Verify forecast was updated
      await expect(page.locator('text="Forecast updated"')).toBeVisible()
      await expect(page.locator('text="$75,000"')).toBeVisible()
    }
  })
})