import { Page } from '@playwright/test'

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  
  // Fill in login form
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  
  // Submit form
  await page.click('button[type="submit"]')
  
  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

export async function logout(page: Page) {
  // Click on user menu
  await page.click('[data-testid="user-menu"]')
  
  // Click logout button
  await page.click('[data-testid="logout-button"]')
  
  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 5000 })
}

export async function setupAuthState(page: Page) {
  // This can be used to set up authentication state before tests
  // For now, we'll use regular login flow
  const testEmail = process.env.TEST_USER_EMAIL || 'test@ics.ac'
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123'
  
  await login(page, testEmail, testPassword)
}