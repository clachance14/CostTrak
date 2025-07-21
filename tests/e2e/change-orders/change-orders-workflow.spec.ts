import { test, expect, Page } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

test.describe('Change Orders Workflow', () => {
  let projectId: string
  const testData = {
    changeOrder: {
      number: `CO-${Date.now()}`,
      description: 'Additional electrical work for new server room',
      amount: 75000,
      type: 'increase' as const,
      reason: 'Client requested additional server room capacity',
      attachmentFile: 'test-files/change-order-doc.pdf'
    },
    decreaseOrder: {
      number: `CO-DEC-${Date.now()}`,
      description: 'Remove landscape lighting from scope',
      amount: -15000,
      type: 'decrease' as const,
      reason: 'Client decided to handle landscaping separately'
    }
  }

  test.beforeEach(async ({ page }) => {
    // Login as project manager who can create change orders
    await setupAuthState(page, 'project_manager')
    
    // Navigate to projects and select first available project
    await page.goto('/projects')
    await page.waitForSelector('[data-testid="projects-list"]')
    
    // Click on first project
    const firstProject = await page.locator('[data-testid="project-row"]').first()
    projectId = await firstProject.getAttribute('data-project-id') || ''
    await firstProject.click()
    
    // Wait for project detail page
    await page.waitForSelector('[data-testid="project-detail"]')
  })

  test.describe('Create Change Order', () => {
    test('should create an increase change order successfully', async ({ page }) => {
      // Navigate to change orders tab
      await page.click('[data-testid="change-orders-tab"]')
      await page.waitForSelector('[data-testid="change-orders-list"]')
      
      // Click create new change order
      await page.click('button:has-text("New Change Order")')
      await page.waitForSelector('[data-testid="change-order-form"]')
      
      // Fill in change order details
      await page.fill('input[name="co_number"]', testData.changeOrder.number)
      await page.fill('textarea[name="description"]', testData.changeOrder.description)
      await page.fill('input[name="amount"]', testData.changeOrder.amount.toString())
      await page.selectOption('select[name="type"]', testData.changeOrder.type)
      await page.fill('textarea[name="reason"]', testData.changeOrder.reason)
      
      // Submit form
      await page.click('button[type="submit"]:has-text("Create Change Order")')
      
      // Verify success message
      await expect(page.locator('.toast-success, [data-testid="success-message"]')).toBeVisible()
      
      // Verify change order appears in list
      await expect(page.locator(`[data-testid="co-${testData.changeOrder.number}"]`)).toBeVisible()
      
      // Verify status is pending approval
      const statusBadge = page.locator(`[data-testid="co-${testData.changeOrder.number}"] [data-testid="status-badge"]`)
      await expect(statusBadge).toHaveText('Pending')
    })

    test('should create a decrease change order', async ({ page }) => {
      await page.click('[data-testid="change-orders-tab"]')
      await page.click('button:has-text("New Change Order")')
      
      // Fill decrease order
      await page.fill('input[name="co_number"]', testData.decreaseOrder.number)
      await page.fill('textarea[name="description"]', testData.decreaseOrder.description)
      await page.fill('input[name="amount"]', Math.abs(testData.decreaseOrder.amount).toString())
      await page.selectOption('select[name="type"]', testData.decreaseOrder.type)
      await page.fill('textarea[name="reason"]', testData.decreaseOrder.reason)
      
      await page.click('button[type="submit"]')
      
      // Verify negative amount is displayed correctly
      const amountCell = page.locator(`[data-testid="co-${testData.decreaseOrder.number}"] [data-testid="amount"]`)
      await expect(amountCell).toHaveText(/-\$15,000/)
    })

    test('should validate required fields', async ({ page }) => {
      await page.click('[data-testid="change-orders-tab"]')
      await page.click('button:has-text("New Change Order")')
      
      // Try to submit empty form
      await page.click('button[type="submit"]')
      
      // Check for validation errors
      await expect(page.locator('[data-testid="error-co_number"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-description"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-amount"]')).toBeVisible()
    })

    test('should prevent duplicate CO numbers', async ({ page }) => {
      // Create first CO
      await createChangeOrder(page, testData.changeOrder)
      
      // Try to create another with same number
      await page.click('button:has-text("New Change Order")')
      await page.fill('input[name="co_number"]', testData.changeOrder.number)
      await page.fill('textarea[name="description"]', 'Duplicate test')
      await page.fill('input[name="amount"]', '1000')
      await page.click('button[type="submit"]')
      
      // Should show error
      await expect(page.locator('.toast-error, [data-testid="error-message"]')).toContainText('already exists')
    })
  })

  test.describe('Approval Workflow', () => {
    test('project manager cannot approve their own change orders', async ({ page }) => {
      // Create a change order
      await createChangeOrder(page, testData.changeOrder)
      
      // Click on the change order
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      await page.waitForSelector('[data-testid="change-order-detail"]')
      
      // Approve button should not be visible for creator
      await expect(page.locator('button:has-text("Approve")')).not.toBeVisible()
    })

    test('controller can approve change orders', async ({ page }) => {
      // Create CO as project manager
      await createChangeOrder(page, testData.changeOrder)
      
      // Logout and login as controller
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'controller')
      
      // Navigate to the project
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      
      // Click on the change order
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      
      // Approve button should be visible
      const approveButton = page.locator('button:has-text("Approve")')
      await expect(approveButton).toBeVisible()
      
      // Add approval comment
      await page.fill('textarea[name="approval_comment"]', 'Approved for immediate execution')
      
      // Click approve
      await approveButton.click()
      
      // Confirm in dialog
      await page.click('button:has-text("Confirm Approval")')
      
      // Verify status changed
      await expect(page.locator('[data-testid="status-badge"]')).toHaveText('Approved')
      
      // Verify contract values updated
      await page.goto(`/projects/${projectId}`)
      const revisedContract = await page.locator('[data-testid="revised-contract-amount"]').textContent()
      expect(revisedContract).toContain('75,000') // Should include the CO amount
    })

    test('should create audit trail for approvals', async ({ page }) => {
      // Create and approve a CO (setup as above)
      await createChangeOrder(page, testData.changeOrder)
      
      // Login as controller and approve
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'controller')
      
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      
      await page.fill('textarea[name="approval_comment"]', 'Approved per client request')
      await page.click('button:has-text("Approve")')
      await page.click('button:has-text("Confirm Approval")')
      
      // Check audit trail
      await page.click('[data-testid="audit-trail-tab"]')
      
      const auditEntry = page.locator('[data-testid="audit-entry"]').first()
      await expect(auditEntry).toContainText('Change Order Approved')
      await expect(auditEntry).toContainText('controller@ics.ac')
      await expect(auditEntry).toContainText('Approved per client request')
    })

    test('executive can approve high-value change orders', async ({ page }) => {
      // Create high-value CO
      const highValueCO = {
        ...testData.changeOrder,
        number: `CO-HIGH-${Date.now()}`,
        amount: 500000 // High value requiring executive approval
      }
      
      await createChangeOrder(page, highValueCO)
      
      // Login as executive
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'executive')
      
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      await page.click(`[data-testid="co-${highValueCO.number}"]`)
      
      // Should see high-value indicator
      await expect(page.locator('[data-testid="high-value-indicator"]')).toBeVisible()
      
      // Approve
      await page.click('button:has-text("Executive Approve")')
      await page.click('button:has-text("Confirm Approval")')
      
      await expect(page.locator('[data-testid="status-badge"]')).toHaveText('Approved')
    })
  })

  test.describe('Rejection Workflow', () => {
    test('should allow rejection with reason', async ({ page }) => {
      await createChangeOrder(page, testData.changeOrder)
      
      // Login as controller
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'controller')
      
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      
      // Click reject
      await page.click('button:has-text("Reject")')
      
      // Fill rejection reason
      await page.fill('textarea[name="rejection_reason"]', 'Budget constraints - please revise scope')
      await page.click('button:has-text("Confirm Rejection")')
      
      // Verify status
      await expect(page.locator('[data-testid="status-badge"]')).toHaveText('Rejected')
      
      // Verify rejection reason is displayed
      await expect(page.locator('[data-testid="rejection-reason"]')).toContainText('Budget constraints')
    })

    test('should not affect contract values when rejected', async ({ page }) => {
      // Get original contract value
      const originalContract = await page.locator('[data-testid="revised-contract-amount"]').textContent()
      
      // Create and reject CO
      await createChangeOrder(page, testData.changeOrder)
      
      // Login as controller and reject
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'controller')
      
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      
      await page.click('button:has-text("Reject")')
      await page.fill('textarea[name="rejection_reason"]', 'Not approved')
      await page.click('button:has-text("Confirm Rejection")')
      
      // Go back to project overview
      await page.click('[data-testid="overview-tab"]')
      
      // Contract value should remain unchanged
      const currentContract = await page.locator('[data-testid="revised-contract-amount"]').textContent()
      expect(currentContract).toBe(originalContract)
    })
  })

  test.describe('Attachments', () => {
    test('should upload and download attachments', async ({ page }) => {
      await page.click('[data-testid="change-orders-tab"]')
      await page.click('button:has-text("New Change Order")')
      
      // Fill form
      await page.fill('input[name="co_number"]', testData.changeOrder.number)
      await page.fill('textarea[name="description"]', testData.changeOrder.description)
      await page.fill('input[name="amount"]', testData.changeOrder.amount.toString())
      
      // Upload attachment
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles('./tests/fixtures/test-document.pdf')
      
      // Submit
      await page.click('button[type="submit"]')
      
      // Verify attachment uploaded
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      await expect(page.locator('[data-testid="attachment-list"]')).toContainText('test-document.pdf')
      
      // Test download
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="download-attachment"]')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('test-document.pdf')
    })

    test('should support multiple attachments', async ({ page }) => {
      await createChangeOrder(page, testData.changeOrder)
      
      // Add multiple attachments to existing CO
      await page.click(`[data-testid="co-${testData.changeOrder.number}"]`)
      await page.click('button:has-text("Add Attachment")')
      
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles([
        './tests/fixtures/test-document.pdf',
        './tests/fixtures/test-spreadsheet.xlsx',
        './tests/fixtures/test-image.png'
      ])
      
      await page.click('button:has-text("Upload")')
      
      // Verify all files uploaded
      const attachmentList = page.locator('[data-testid="attachment-list"]')
      await expect(attachmentList).toContainText('test-document.pdf')
      await expect(attachmentList).toContainText('test-spreadsheet.xlsx')
      await expect(attachmentList).toContainText('test-image.png')
    })
  })

  test.describe('Impact on Project Financials', () => {
    test('should update revised contract after approval', async ({ page }) => {
      // Get initial values
      const originalContractText = await page.locator('[data-testid="original-contract-amount"]').textContent()
      const originalContract = parseFloat(originalContractText?.replace(/[$,]/g, '') || '0')
      
      // Create and approve multiple COs
      const changeOrders = [
        { ...testData.changeOrder, amount: 50000 },
        { ...testData.decreaseOrder, amount: -10000 },
        { number: `CO-3-${Date.now()}`, description: 'Additional work', amount: 25000 }
      ]
      
      let totalCOAmount = 0
      
      for (const co of changeOrders) {
        await createChangeOrder(page, co)
        totalCOAmount += co.amount
      }
      
      // Login as controller and approve all
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'controller')
      
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      
      // Approve each CO
      for (const co of changeOrders) {
        await page.click(`[data-testid="co-${co.number}"]`)
        await page.click('button:has-text("Approve")')
        await page.click('button:has-text("Confirm Approval")')
        await page.click('[data-testid="back-to-list"]')
      }
      
      // Check updated contract value
      await page.click('[data-testid="overview-tab"]')
      const revisedContractText = await page.locator('[data-testid="revised-contract-amount"]').textContent()
      const revisedContract = parseFloat(revisedContractText?.replace(/[$,]/g, '') || '0')
      
      expect(revisedContract).toBe(originalContract + totalCOAmount)
      
      // Verify CO summary
      const coSummary = await page.locator('[data-testid="change-order-summary"]').textContent()
      expect(coSummary).toContain('3 Approved')
      expect(coSummary).toContain(`$${Math.abs(totalCOAmount).toLocaleString()}`)
    })

    test('should track CO history chronologically', async ({ page }) => {
      // Create multiple COs with different dates
      const cos = [
        { ...testData.changeOrder, number: 'CO-001', created_at: '2025-01-01' },
        { ...testData.changeOrder, number: 'CO-002', created_at: '2025-01-15' },
        { ...testData.changeOrder, number: 'CO-003', created_at: '2025-02-01' }
      ]
      
      for (const co of cos) {
        await createChangeOrder(page, co)
      }
      
      // Check chronological order
      await page.click('[data-testid="change-orders-tab"]')
      const coRows = page.locator('[data-testid^="co-"]')
      
      // Should be in reverse chronological order (newest first)
      await expect(coRows.nth(0)).toHaveAttribute('data-testid', 'co-CO-003')
      await expect(coRows.nth(1)).toHaveAttribute('data-testid', 'co-CO-002')
      await expect(coRows.nth(2)).toHaveAttribute('data-testid', 'co-CO-001')
    })
  })

  test.describe('Permissions and Security', () => {
    test('viewer role cannot create or approve change orders', async ({ page }) => {
      // Login as viewer
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'viewer')
      
      await page.goto(`/projects/${projectId}`)
      await page.click('[data-testid="change-orders-tab"]')
      
      // Should not see create button
      await expect(page.locator('button:has-text("New Change Order")')).not.toBeVisible()
      
      // View existing CO
      if (await page.locator('[data-testid^="co-"]').count() > 0) {
        await page.click('[data-testid^="co-"]').first()
        
        // Should not see approve/reject buttons
        await expect(page.locator('button:has-text("Approve")')).not.toBeVisible()
        await expect(page.locator('button:has-text("Reject")')).not.toBeVisible()
      }
    })

    test('should enforce division-based access for ops managers', async ({ page }) => {
      // Login as ops manager
      await page.click('[data-testid="user-menu"]')
      await page.click('button:has-text("Logout")')
      await setupAuthState(page, 'ops_manager')
      
      // Should only see projects in their division
      await page.goto('/projects')
      const projects = page.locator('[data-testid="project-row"]')
      const count = await projects.count()
      
      for (let i = 0; i < count; i++) {
        const division = await projects.nth(i).locator('[data-testid="division"]').textContent()
        expect(division).toBe('Division A') // Assuming test ops manager is in Division A
      }
    })
  })

  // Helper function to create a change order
  async function createChangeOrder(page: Page, data: any) {
    await page.click('[data-testid="change-orders-tab"]')
    await page.click('button:has-text("New Change Order")')
    await page.fill('input[name="co_number"]', data.number)
    await page.fill('textarea[name="description"]', data.description)
    await page.fill('input[name="amount"]', Math.abs(data.amount).toString())
    if (data.type) {
      await page.selectOption('select[name="type"]', data.type)
    }
    if (data.reason) {
      await page.fill('textarea[name="reason"]', data.reason)
    }
    await page.click('button[type="submit"]')
    await page.waitForSelector('.toast-success, [data-testid="success-message"]')
  }
})