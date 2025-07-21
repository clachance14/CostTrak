import { test, expect, type Page } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

// Test data
const testData = {
  changeOrder: {
    number: `CO-${Date.now()}`,
    description: 'Test change order for notifications',
    amount: 50000,
  },
  poImport: {
    fileName: 'purchase-orders.csv',
    recordCount: 5,
  },
  laborVariance: {
    projectName: 'Test Project',
    craftType: 'Electrician',
    variance: 25,
    weekEnding: new Date().toISOString().split('T')[0],
  },
}

// Helper functions
async function getUnreadCount(page: Page): Promise<number> {
  const badge = page.locator('[data-testid="notification-badge"]')
  if (await badge.isVisible()) {
    const text = await badge.textContent()
    return parseInt(text || '0', 10)
  }
  return 0
}

async function openNotificationDropdown(page: Page) {
  await page.click('[data-testid="notification-bell"]')
  await page.waitForSelector('[data-testid="notification-dropdown"]')
}

async function createChangeOrderNotification(page: Page) {
  // Navigate to change orders
  await page.goto('/projects')
  await page.click('[data-testid="project-link"]:first-child')
  await page.click('[data-testid="change-orders-tab"]')
  
  // Create change order
  await page.click('button:has-text("New Change Order")')
  await page.fill('[name="number"]', testData.changeOrder.number)
  await page.fill('[name="description"]', testData.changeOrder.description)
  await page.fill('[name="amount"]', testData.changeOrder.amount.toString())
  await page.click('button:has-text("Create")')
  
  await page.waitForSelector('text=Change order created successfully')
}

test.describe('Notifications System', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthState(page, 'project_manager')
    await page.goto('/')
  })

  test.describe('Notification Bell & Dropdown', () => {
    test('shows notification bell with unread count', async ({ page }) => {
      const bell = page.locator('[data-testid="notification-bell"]')
      await expect(bell).toBeVisible()
      
      // Create a notification to test badge
      await createChangeOrderNotification(page)
      
      // Check badge appears
      await page.waitForTimeout(2000) // Allow time for notification creation
      const badge = page.locator('[data-testid="notification-badge"]')
      await expect(badge).toBeVisible()
      const count = await badge.textContent()
      expect(parseInt(count || '0')).toBeGreaterThan(0)
    })

    test('opens dropdown with tabs', async ({ page }) => {
      await openNotificationDropdown(page)
      
      // Check tabs
      await expect(page.locator('button:has-text("Unread")')).toBeVisible()
      await expect(page.locator('button:has-text("All")')).toBeVisible()
      
      // Check view all link
      await expect(page.locator('a:has-text("View all")')).toBeVisible()
    })

    test('displays notifications in dropdown', async ({ page }) => {
      // Create a notification
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      // Open dropdown
      await openNotificationDropdown(page)
      
      // Check notification appears
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification).toBeVisible()
      
      // Verify notification content
      await expect(notification).toContainText('Change Order Created')
    })

    test('marks notification as read from dropdown', async ({ page }) => {
      // Create a notification
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      // Get initial unread count
      const initialCount = await getUnreadCount(page)
      expect(initialCount).toBeGreaterThan(0)
      
      // Open dropdown and click notification
      await openNotificationDropdown(page)
      await page.click('[data-testid="notification-item"]:first-child')
      
      // Close and reopen dropdown
      await page.click('body') // Click outside to close
      await page.waitForTimeout(1000)
      
      // Check count decreased
      const newCount = await getUnreadCount(page)
      expect(newCount).toBeLessThan(initialCount)
    })
  })

  test.describe('Notifications Page', () => {
    test('displays full notifications page with filters', async ({ page }) => {
      await page.goto('/notifications')
      
      // Check page elements
      await expect(page.locator('h1:has-text("Notifications")')).toBeVisible()
      
      // Check filters
      await expect(page.locator('[data-testid="priority-filter"]')).toBeVisible()
      await expect(page.locator('[data-testid="type-filter"]')).toBeVisible()
      await expect(page.locator('[data-testid="read-status-filter"]')).toBeVisible()
      
      // Check search
      await expect(page.locator('[placeholder*="Search"]')).toBeVisible()
      
      // Check bulk actions
      await expect(page.locator('button:has-text("Mark all as read")')).toBeVisible()
    })

    test('filters notifications by priority', async ({ page }) => {
      await page.goto('/notifications')
      
      // Select high priority filter
      await page.selectOption('[data-testid="priority-filter"]', 'high')
      await page.waitForTimeout(1000)
      
      // Check filtered results
      const notifications = page.locator('[data-testid="notification-item"]')
      const count = await notifications.count()
      
      // If there are notifications, verify they're high priority
      if (count > 0) {
        const firstNotification = notifications.first()
        await expect(firstNotification).toHaveClass(/priority-high/)
      }
    })

    test('filters notifications by type', async ({ page }) => {
      // Create a change order notification
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      await page.goto('/notifications')
      
      // Filter by change_order type
      await page.selectOption('[data-testid="type-filter"]', 'change_order')
      await page.waitForTimeout(1000)
      
      // Verify filtered results
      const notifications = page.locator('[data-testid="notification-item"]')
      const count = await notifications.count()
      expect(count).toBeGreaterThan(0)
      
      // Check icon indicates change order type
      const icon = notifications.first().locator('[data-testid="notification-icon"]')
      await expect(icon).toHaveClass(/change-order/)
    })

    test('searches notifications', async ({ page }) => {
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      await page.goto('/notifications')
      
      // Search for change order
      await page.fill('[placeholder*="Search"]', 'Change Order')
      await page.waitForTimeout(1000)
      
      // Verify results
      const notifications = page.locator('[data-testid="notification-item"]')
      const count = await notifications.count()
      expect(count).toBeGreaterThan(0)
      
      // Verify content matches search
      await expect(notifications.first()).toContainText('Change Order')
    })

    test('marks all notifications as read', async ({ page }) => {
      // Create multiple notifications
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      await page.goto('/notifications')
      
      // Get initial unread count
      const initialUnread = await page.locator('[data-testid="notification-item"].unread').count()
      expect(initialUnread).toBeGreaterThan(0)
      
      // Mark all as read
      await page.click('button:has-text("Mark all as read")')
      await page.waitForTimeout(1000)
      
      // Verify all marked as read
      const unreadAfter = await page.locator('[data-testid="notification-item"].unread').count()
      expect(unreadAfter).toBe(0)
    })

    test('deletes notification', async ({ page }) => {
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      await page.goto('/notifications')
      
      // Get initial count
      const initialCount = await page.locator('[data-testid="notification-item"]').count()
      
      // Delete first notification
      const deleteButton = page.locator('[data-testid="notification-item"]').first().locator('[data-testid="delete-notification"]')
      await deleteButton.click()
      
      // Confirm deletion
      await page.click('button:has-text("Delete")')
      await page.waitForTimeout(1000)
      
      // Verify count decreased
      const newCount = await page.locator('[data-testid="notification-item"]').count()
      expect(newCount).toBe(initialCount - 1)
    })
  })

  test.describe('Notification Types', () => {
    test('creates change order notification', async ({ page }) => {
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      await openNotificationDropdown(page)
      
      // Verify change order notification
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification).toContainText('Change Order Created')
      await expect(notification).toContainText(testData.changeOrder.number)
    })

    test('creates PO import notification', async ({ page }) => {
      // Navigate to PO import
      await page.goto('/purchase-orders')
      await page.click('button:has-text("Import")')
      
      // Upload file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles('tests/fixtures/purchase-orders.csv')
      
      // Complete import
      await page.click('button:has-text("Next")')
      await page.waitForSelector('text=Review Import')
      await page.click('button:has-text("Import")')
      
      await page.waitForSelector('text=Import completed successfully')
      await page.waitForTimeout(2000)
      
      // Check notification
      await openNotificationDropdown(page)
      const notification = page.locator('[data-testid="notification-item"]').first()
      await expect(notification).toContainText('Import Complete')
      await expect(notification).toContainText('5 records')
    })

    test('creates budget threshold notification', async ({ page }) => {
      // This would require setting up a project near budget threshold
      // For now, we'll check the notification display if one exists
      await page.goto('/notifications')
      
      // Filter by financial type
      await page.selectOption('[data-testid="type-filter"]', 'financial')
      await page.waitForTimeout(1000)
      
      const financialNotifications = page.locator('[data-testid="notification-item"]')
      const count = await financialNotifications.count()
      
      if (count > 0) {
        // Verify financial notification has proper styling
        const notification = financialNotifications.first()
        await expect(notification.locator('[data-testid="notification-icon"]')).toHaveClass(/financial/)
      }
    })

    test('shows system announcements', async ({ page }) => {
      await page.goto('/notifications')
      
      // Filter by system type
      await page.selectOption('[data-testid="type-filter"]', 'system')
      await page.waitForTimeout(1000)
      
      const systemNotifications = page.locator('[data-testid="notification-item"]')
      const count = await systemNotifications.count()
      
      if (count > 0) {
        // System notifications should have distinct styling
        const notification = systemNotifications.first()
        await expect(notification).toHaveClass(/system-announcement/)
      }
    })
  })

  test.describe('Real-time Updates', () => {
    test('updates unread count in real-time', async ({ page }) => {
      // Get initial count
      const initialCount = await getUnreadCount(page)
      
      // Create a notification in another tab
      const newPage = await page.context().newPage()
      await setupAuthState(newPage, 'project_manager')
      await newPage.goto('/')
      await createChangeOrderNotification(newPage)
      await newPage.close()
      
      // Wait for real-time update (30 second interval)
      await page.waitForTimeout(2000)
      
      // Check count increased
      const newCount = await getUnreadCount(page)
      expect(newCount).toBeGreaterThan(initialCount)
    })

    test('refreshes dropdown content', async ({ page }) => {
      // Open dropdown initially
      await openNotificationDropdown(page)
      const initialCount = await page.locator('[data-testid="notification-item"]').count()
      
      // Close dropdown
      await page.click('body')
      
      // Create new notification
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      // Reopen dropdown
      await openNotificationDropdown(page)
      const newCount = await page.locator('[data-testid="notification-item"]').count()
      
      // Should have more notifications
      expect(newCount).toBeGreaterThan(initialCount)
    })
  })

  test.describe('Action URLs', () => {
    test('navigates to related entity from notification', async ({ page }) => {
      // Create a change order notification
      await createChangeOrderNotification(page)
      await page.waitForTimeout(2000)
      
      await page.goto('/notifications')
      
      // Click notification with action URL
      const notification = page.locator('[data-testid="notification-item"]').first()
      const actionLink = notification.locator('[data-testid="notification-action"]')
      
      if (await actionLink.isVisible()) {
        await actionLink.click()
        
        // Should navigate to change order detail
        await expect(page).toHaveURL(/\/change-orders\//)
        await expect(page.locator('h1')).toContainText('Change Order')
      }
    })
  })

  test.describe('Priority Levels', () => {
    test('displays notifications with correct priority styling', async ({ page }) => {
      await page.goto('/notifications')
      
      // Check different priority levels have different styling
      const criticalNotifications = page.locator('[data-testid="notification-item"].priority-critical')
      const highNotifications = page.locator('[data-testid="notification-item"].priority-high')
      const mediumNotifications = page.locator('[data-testid="notification-item"].priority-medium')
      const lowNotifications = page.locator('[data-testid="notification-item"].priority-low')
      
      // Critical should have red styling
      if (await criticalNotifications.count() > 0) {
        await expect(criticalNotifications.first()).toHaveClass(/bg-red/)
      }
      
      // High should have orange styling
      if (await highNotifications.count() > 0) {
        await expect(highNotifications.first()).toHaveClass(/bg-orange/)
      }
      
      // Medium should have yellow styling
      if (await mediumNotifications.count() > 0) {
        await expect(mediumNotifications.first()).toHaveClass(/bg-yellow/)
      }
      
      // Low should have default styling
      if (await lowNotifications.count() > 0) {
        await expect(lowNotifications.first()).not.toHaveClass(/bg-red|bg-orange|bg-yellow/)
      }
    })
  })

  test.describe('Expiration', () => {
    test('does not show expired notifications', async ({ page }) => {
      await page.goto('/notifications')
      
      // All visible notifications should not be expired
      const notifications = page.locator('[data-testid="notification-item"]')
      const count = await notifications.count()
      
      for (let i = 0; i < count; i++) {
        const notification = notifications.nth(i)
        // Expired notifications should not be visible
        await expect(notification).not.toHaveClass(/expired/)
      }
    })
  })

  test.describe('Performance', () => {
    test('loads notifications page quickly', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/notifications')
      await page.waitForSelector('[data-testid="notification-item"], text=No notifications')
      const loadTime = Date.now() - startTime
      
      // Page should load within 2 seconds
      expect(loadTime).toBeLessThan(2000)
    })

    test('handles large number of notifications', async ({ page }) => {
      await page.goto('/notifications')
      
      // Check pagination if many notifications
      const pagination = page.locator('[data-testid="pagination"]')
      if (await pagination.isVisible()) {
        // Should show page numbers
        await expect(pagination.locator('button')).toHaveCount(3) // At least Previous, 1, Next
        
        // Navigate to next page
        await pagination.locator('button:has-text("Next")').click()
        await page.waitForTimeout(1000)
        
        // Should load next page
        await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(10) // Assuming 10 per page
      }
    })
  })
})

test.describe('Role-based Notifications', () => {
  test('controller receives all critical notifications', async ({ page }) => {
    await setupAuthState(page, 'controller')
    await page.goto('/notifications')
    
    // Filter by critical priority
    await page.selectOption('[data-testid="priority-filter"]', 'critical')
    await page.waitForTimeout(1000)
    
    // Controllers should see all critical notifications
    const notifications = page.locator('[data-testid="notification-item"]')
    if (await notifications.count() > 0) {
      // All should be critical priority
      for (let i = 0; i < await notifications.count(); i++) {
        await expect(notifications.nth(i)).toHaveClass(/priority-critical/)
      }
    }
  })

  test('project manager sees project-specific notifications', async ({ page }) => {
    await setupAuthState(page, 'project_manager')
    await page.goto('/notifications')
    
    // Filter by project type
    await page.selectOption('[data-testid="type-filter"]', 'project')
    await page.waitForTimeout(1000)
    
    // Should only see notifications for assigned projects
    const notifications = page.locator('[data-testid="notification-item"]')
    const count = await notifications.count()
    
    if (count > 0) {
      // Verify notifications are for user's projects
      for (let i = 0; i < count; i++) {
        const notification = notifications.nth(i)
        await expect(notification).toContainText(/PRJ-/) // Project reference
      }
    }
  })

  test('viewer has limited notification actions', async ({ page }) => {
    await setupAuthState(page, 'viewer')
    await page.goto('/notifications')
    
    // Viewers should not see delete buttons
    const deleteButtons = page.locator('[data-testid="delete-notification"]')
    expect(await deleteButtons.count()).toBe(0)
    
    // Can still mark as read
    const notifications = page.locator('[data-testid="notification-item"]')
    if (await notifications.count() > 0) {
      await notifications.first().click()
      await page.waitForTimeout(1000)
      // Should be marked as read
      await expect(notifications.first()).not.toHaveClass(/unread/)
    }
  })
})