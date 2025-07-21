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

export async function setupAuthState(page: Page, role: string = 'project_manager') {
  // This can be used to set up authentication state before tests
  // For now, we'll use regular login flow
  const roleCredentials = {
    controller: {
      email: process.env.TEST_CONTROLLER_EMAIL || 'controller@ics.ac',
      password: process.env.TEST_CONTROLLER_PASSWORD || 'testpassword123'
    },
    executive: {
      email: process.env.TEST_EXECUTIVE_EMAIL || 'executive@ics.ac',
      password: process.env.TEST_EXECUTIVE_PASSWORD || 'testpassword123'
    },
    ops_manager: {
      email: process.env.TEST_OPS_EMAIL || 'ops@ics.ac',
      password: process.env.TEST_OPS_PASSWORD || 'testpassword123'
    },
    project_manager: {
      email: process.env.TEST_PM_EMAIL || 'pm@ics.ac',
      password: process.env.TEST_PM_PASSWORD || 'testpassword123'
    },
    accounting: {
      email: process.env.TEST_ACCOUNTING_EMAIL || 'accounting@ics.ac',
      password: process.env.TEST_ACCOUNTING_PASSWORD || 'testpassword123'
    },
    viewer: {
      email: process.env.TEST_VIEWER_EMAIL || 'viewer@ics.ac',
      password: process.env.TEST_VIEWER_PASSWORD || 'testpassword123'
    }
  }
  
  const credentials = roleCredentials[role] || roleCredentials.project_manager
  await login(page, credentials.email, credentials.password)
}