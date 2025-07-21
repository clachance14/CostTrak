import { test, expect } from '@playwright/test'

test.describe('Smoke Test', () => {
  test('should load the login page', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
    
    // Should show login form
    await expect(page.locator('h1')).toContainText('Sign in')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})