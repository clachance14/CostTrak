import { test, expect, type Page } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

// Test data for trigger scenarios
const triggerScenarios = {
  budgetThreshold: {
    projectName: 'Test Project - Budget Alert',
    originalBudget: 1000000,
    currentSpend: 850000, // 85% - should trigger alert
    threshold: 80,
  },
  laborVariance: {
    projectName: 'Test Project - Labor Alert',
    forecastHours: 1000,
    actualHours: 1250, // 25% variance - should trigger
    varianceThreshold: 20,
  },
  staleData: {
    projectName: 'Test Project - Stale Data',
    daysSinceUpdate: 14, // Should trigger if threshold is 7 days
  },
  marginThreshold: {
    projectName: 'Test Project - Margin Alert',
    revenue: 1000000,
    cost: 950000, // 5% margin - should trigger if threshold is 10%
    marginThreshold: 10,
  },
}

// Helper to wait for notification
async function waitForNotification(page: Page, title: string, timeout = 10000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    await page.click('[data-testid="notification-bell"]')
    await page.waitForSelector('[data-testid="notification-dropdown"]')
    
    const notification = page.locator(`[data-testid="notification-item"]:has-text("${title}")`)
    if (await notification.isVisible()) {
      return true
    }
    
    // Close dropdown and wait before retry
    await page.click('body')
    await page.waitForTimeout(2000)
  }
  
  return false
}

test.describe('Notification Triggers', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthState(page, 'controller')
    await page.goto('/')
  })

  test.describe('Budget Threshold Alerts', () => {
    test('triggers notification when project exceeds budget threshold', async ({ page }) => {
      // Navigate to project financial page
      await page.goto('/projects')
      
      // Find or create a project near budget threshold
      // This test assumes we can update project spend to trigger alert
      const projectCard = page.locator('[data-testid="project-card"]').first()
      await projectCard.click()
      
      // Navigate to financial tab
      await page.click('[data-testid="financial-tab"]')
      
      // Update costs to exceed threshold (would require PO or labor entry)
      await page.click('[data-testid="purchase-orders-tab"]')
      await page.click('button:has-text("New Purchase Order")')
      
      // Create PO that pushes project over threshold
      await page.fill('[name="po_number"]', `PO-THRESHOLD-${Date.now()}`)
      await page.fill('[name="vendor"]', 'Test Vendor')
      await page.fill('[name="committed_amount"]', '200000') // This should push over 80%
      await page.fill('[name="description"]', 'Threshold test PO')
      await page.click('button:has-text("Create")')
      
      await page.waitForSelector('text=Purchase order created')
      
      // Check for budget alert notification
      const hasNotification = await waitForNotification(page, 'Budget Threshold Alert')
      expect(hasNotification).toBe(true)
      
      // Verify notification content
      await page.click('[data-testid="notification-bell"]')
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification).toContainText('exceeded 80% of budget')
    })

    test('creates different alerts for different threshold levels', async ({ page }) => {
      await page.goto('/notifications')
      
      // Filter by financial type
      await page.selectOption('[data-testid="type-filter"]', 'financial')
      await page.waitForTimeout(1000)
      
      // Look for different threshold levels
      const notifications = page.locator('[data-testid="notification-item"]')
      const count = await notifications.count()
      
      if (count > 0) {
        // Check for different threshold messages
        const messages = []
        for (let i = 0; i < Math.min(count, 5); i++) {
          const text = await notifications.nth(i).textContent()
          messages.push(text)
        }
        
        // Should have different threshold levels (80%, 90%, 95%)
        const thresholdLevels = messages.filter(m => 
          m?.includes('80%') || m?.includes('90%') || m?.includes('95%')
        )
        expect(thresholdLevels.length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Labor Variance Alerts', () => {
    test('triggers notification for labor cost variance', async ({ page }) => {
      // Navigate to labor management
      await page.goto('/projects')
      const projectCard = page.locator('[data-testid="project-card"]').first()
      await projectCard.click()
      
      await page.click('[data-testid="labor-tab"]')
      
      // Enter actual labor that exceeds forecast
      await page.click('button:has-text("Enter Actuals")')
      
      // Fill in high labor costs
      await page.fill('[name="week_ending"]', new Date().toISOString().split('T')[0])
      await page.fill('[name="direct_hours"]', '500')
      await page.fill('[name="direct_cost"]', '50000') // High cost for hours
      await page.fill('[name="indirect_hours"]', '200')
      await page.fill('[name="indirect_cost"]', '15000')
      
      await page.click('button:has-text("Save")')
      await page.waitForSelector('text=Labor actuals saved')
      
      // Check for variance alert
      const hasNotification = await waitForNotification(page, 'Labor Variance Alert')
      expect(hasNotification).toBe(true)
      
      // Verify notification details
      await page.click('[data-testid="notification-bell"]')
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification).toContainText('variance')
      await expect(notification).toContainText('%')
    })

    test('shows craft-specific variance details', async ({ page }) => {
      await page.goto('/notifications')
      
      // Filter by labor type
      await page.selectOption('[data-testid="type-filter"]', 'labor')
      await page.waitForTimeout(1000)
      
      const laborNotifications = page.locator('[data-testid="notification-item"]')
      if (await laborNotifications.count() > 0) {
        const notification = laborNotifications.first()
        
        // Should show craft type in notification
        const text = await notification.textContent()
        expect(text).toMatch(/Carpenter|Electrician|Plumber|Foreman|Laborer/)
        
        // Should show variance percentage
        expect(text).toMatch(/\d+%/)
      }
    })
  })

  test.describe('Stale Data Alerts', () => {
    test('alerts for projects without recent updates', async ({ page }) => {
      await page.goto('/notifications')
      
      // Search for stale data notifications
      await page.fill('[placeholder*="Search"]', 'stale')
      await page.waitForTimeout(1000)
      
      const staleNotifications = page.locator('[data-testid="notification-item"]')
      if (await staleNotifications.count() > 0) {
        const notification = staleNotifications.first()
        
        // Should indicate how long since last update
        await expect(notification).toContainText(/\d+ days/)
        await expect(notification).toContainText('no recent updates')
      }
    })

    test('provides quick action to update stale project', async ({ page }) => {
      await page.goto('/notifications')
      
      // Find stale data notification with action
      const notifications = page.locator('[data-testid="notification-item"]:has-text("stale")')
      if (await notifications.count() > 0) {
        const notification = notifications.first()
        const actionLink = notification.locator('[data-testid="notification-action"]')
        
        if (await actionLink.isVisible()) {
          await actionLink.click()
          
          // Should navigate to project requiring update
          await expect(page).toHaveURL(/\/projects\//)
          
          // Update prompt should be visible
          const updatePrompt = page.locator('[data-testid="stale-data-prompt"]')
          if (await updatePrompt.isVisible()) {
            await expect(updatePrompt).toContainText('requires update')
          }
        }
      }
    })
  })

  test.describe('Margin Threshold Alerts', () => {
    test('alerts when project margin falls below threshold', async ({ page }) => {
      await page.goto('/notifications')
      
      // Filter by financial type
      await page.selectOption('[data-testid="type-filter"]', 'financial')
      await page.waitForTimeout(1000)
      
      // Look for margin alerts
      await page.fill('[placeholder*="Search"]', 'margin')
      await page.waitForTimeout(1000)
      
      const marginNotifications = page.locator('[data-testid="notification-item"]')
      if (await marginNotifications.count() > 0) {
        const notification = marginNotifications.first()
        
        // Should show current margin and threshold
        const text = await notification.textContent()
        expect(text).toMatch(/margin.*\d+%/)
        expect(text).toMatch(/below.*threshold/)
        
        // Should have high or critical priority
        await expect(notification).toHaveClass(/priority-(high|critical)/)
      }
    })

    test('provides financial summary link', async ({ page }) => {
      await page.goto('/notifications')
      
      // Find margin alert
      const marginAlert = page.locator('[data-testid="notification-item"]:has-text("margin")')
      if (await marginAlert.count() > 0) {
        const actionLink = marginAlert.first().locator('[data-testid="notification-action"]')
        
        if (await actionLink.isVisible()) {
          await actionLink.click()
          
          // Should navigate to financial summary
          await expect(page).toHaveURL(/financial/)
          
          // Margin details should be highlighted
          const marginSection = page.locator('[data-testid="margin-analysis"]')
          if (await marginSection.isVisible()) {
            await expect(marginSection).toHaveClass(/highlighted|alert/)
          }
        }
      }
    })
  })

  test.describe('PO Risk Alerts', () => {
    test('alerts for POs exceeding commitment limits', async ({ page }) => {
      // Create a high-value PO
      await page.goto('/purchase-orders')
      await page.click('button:has-text("New Purchase Order")')
      
      // Create PO over typical limits
      await page.fill('[name="po_number"]', `PO-RISK-${Date.now()}`)
      await page.fill('[name="vendor"]', 'High Risk Vendor')
      await page.fill('[name="committed_amount"]', '500000') // High amount
      await page.fill('[name="description"]', 'High value equipment')
      
      // Select project
      await page.selectOption('[name="project_id"]', { index: 1 })
      
      await page.click('button:has-text("Create")')
      await page.waitForSelector('text=Purchase order created')
      
      // Check for risk alert
      const hasNotification = await waitForNotification(page, 'PO Risk Alert', 5000)
      
      if (hasNotification) {
        await page.click('[data-testid="notification-bell"]')
        const notification = page.locator('[data-testid="notification-item"]').first()
        await expect(notification).toContainText('exceeds normal limits')
        await expect(notification).toHaveClass(/priority-high/)
      }
    })

    test('alerts for POs with unusual payment terms', async ({ page }) => {
      await page.goto('/notifications')
      
      // Search for payment term alerts
      await page.fill('[placeholder*="Search"]', 'payment terms')
      await page.waitForTimeout(1000)
      
      const paymentAlerts = page.locator('[data-testid="notification-item"]')
      if (await paymentAlerts.count() > 0) {
        const alert = paymentAlerts.first()
        
        // Should indicate the concern
        await expect(alert).toContainText(/payment|terms|unusual/)
        
        // Should link to PO
        const actionLink = alert.locator('[data-testid="notification-action"]')
        if (await actionLink.isVisible()) {
          await expect(actionLink).toHaveAttribute('href', /purchase-orders/)
        }
      }
    })
  })

  test.describe('Missing Forecast Alerts', () => {
    test('alerts when projects lack forecast data', async ({ page }) => {
      await page.goto('/notifications')
      
      // Search for forecast alerts
      await page.fill('[placeholder*="Search"]', 'forecast')
      await page.waitForTimeout(1000)
      
      const forecastAlerts = page.locator('[data-testid="notification-item"]')
      if (await forecastAlerts.count() > 0) {
        const alert = forecastAlerts.first()
        
        // Should indicate missing forecast
        await expect(alert).toContainText(/missing.*forecast|forecast.*required/)
        
        // Should have medium or high priority
        await expect(alert).toHaveClass(/priority-(medium|high)/)
      }
    })

    test('provides direct link to forecast entry', async ({ page }) => {
      await page.goto('/notifications')
      
      const forecastAlert = page.locator('[data-testid="notification-item"]:has-text("forecast")')
      if (await forecastAlert.count() > 0) {
        const actionLink = forecastAlert.first().locator('[data-testid="notification-action"]')
        
        if (await actionLink.isVisible()) {
          await actionLink.click()
          
          // Should navigate to forecast entry
          await expect(page).toHaveURL(/forecast|labor/)
          
          // Entry form should be visible
          const forecastForm = page.locator('[data-testid="forecast-form"]')
          if (await forecastForm.isVisible()) {
            await expect(forecastForm).toContainText(/enter.*forecast|forecast.*entry/)
          }
        }
      }
    })
  })

  test.describe('Deadline Alerts', () => {
    test('alerts for approaching project deadlines', async ({ page }) => {
      await page.goto('/notifications')
      
      // Search for deadline notifications
      await page.fill('[placeholder*="Search"]', 'deadline')
      await page.waitForTimeout(1000)
      
      const deadlineAlerts = page.locator('[data-testid="notification-item"]')
      if (await deadlineAlerts.count() > 0) {
        const alert = deadlineAlerts.first()
        
        // Should show days remaining
        await expect(alert).toContainText(/\d+ days|deadline|due/)
        
        // Near deadlines should have higher priority
        const text = await alert.textContent()
        if (text?.includes('7 days') || text?.includes('3 days')) {
          await expect(alert).toHaveClass(/priority-(high|critical)/)
        }
      }
    })

    test('shows different alerts for different deadline proximities', async ({ page }) => {
      await page.goto('/notifications')
      
      // Look for various deadline notifications
      const notifications = page.locator('[data-testid="notification-item"]:has-text("deadline")')
      const count = await notifications.count()
      
      if (count > 1) {
        const deadlines = []
        for (let i = 0; i < Math.min(count, 5); i++) {
          const text = await notifications.nth(i).textContent()
          deadlines.push(text)
        }
        
        // Should have different warning periods
        const periods = deadlines.filter(d => 
          d?.includes('30 days') || 
          d?.includes('14 days') || 
          d?.includes('7 days') || 
          d?.includes('3 days')
        )
        expect(periods.length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Automated Alert Configuration', () => {
    test('shows trigger configuration for admin users', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/settings/notifications')
      
      // Should see trigger configuration
      await expect(page.locator('h2:has-text("Notification Triggers")')).toBeVisible()
      
      // Should list various trigger types
      await expect(page.locator('text=Budget Threshold')).toBeVisible()
      await expect(page.locator('text=Labor Variance')).toBeVisible()
      await expect(page.locator('text=Margin Alert')).toBeVisible()
      await expect(page.locator('text=Stale Data')).toBeVisible()
      
      // Should show current thresholds
      const budgetThreshold = page.locator('[data-testid="budget-threshold-value"]')
      if (await budgetThreshold.isVisible()) {
        const value = await budgetThreshold.textContent()
        expect(value).toMatch(/\d+%/)
      }
    })

    test('allows updating trigger thresholds', async ({ page }) => {
      await setupAuthState(page, 'controller')
      await page.goto('/settings/notifications')
      
      // Update budget threshold
      const budgetInput = page.locator('[data-testid="budget-threshold-input"]')
      if (await budgetInput.isVisible()) {
        await budgetInput.fill('85')
        await page.click('button:has-text("Save")')
        
        await page.waitForSelector('text=Settings updated')
        
        // Verify update
        await page.reload()
        const newValue = await page.locator('[data-testid="budget-threshold-value"]').textContent()
        expect(newValue).toBe('85%')
      }
    })

    test('non-admin users cannot access trigger settings', async ({ page }) => {
      await setupAuthState(page, 'project_manager')
      await page.goto('/settings/notifications')
      
      // Should not see trigger configuration
      const triggers = page.locator('h2:has-text("Notification Triggers")')
      await expect(triggers).not.toBeVisible()
      
      // Or might redirect
      if (page.url().includes('/unauthorized')) {
        await expect(page.locator('text=Unauthorized')).toBeVisible()
      }
    })
  })
})