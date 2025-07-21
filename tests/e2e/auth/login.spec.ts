import { test, expect } from '@playwright/test'
import { login, logout } from '../utils/auth.helper'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the login page
    await page.goto('/login')
  })

  test('should display login form', async ({ page }) => {
    // Check for presence of login form elements
    await expect(page.locator('h1')).toContainText('Sign in')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show error for invalid email domain', async ({ page }) => {
    // Try to login with non-ics.ac email
    await page.fill('input[type="email"]', 'test@gmail.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('[role="alert"]')).toContainText('Only @ics.ac email addresses are allowed')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Try to login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@ics.ac')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('[role="alert"]')).toBeVisible()
  })

  test('should successfully login with valid credentials', async ({ page }) => {
    // Use test credentials
    const testEmail = process.env.TEST_USER_EMAIL || 'test@ics.ac'
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123'

    await login(page, testEmail, testPassword)

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard')
    
    // Should show user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })

  test('should successfully logout', async ({ page }) => {
    // First login
    const testEmail = process.env.TEST_USER_EMAIL || 'test@ics.ac'
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123'
    
    await login(page, testEmail, testPassword)
    
    // Then logout
    await logout(page)

    // Should be redirected to login page
    await expect(page).toHaveURL('/login')
    
    // Login form should be visible again
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard')

    // Should be redirected to login
    await expect(page).toHaveURL('/login')
  })
})