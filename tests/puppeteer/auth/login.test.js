/**
 * Authentication E2E Test for SuperClaude
 * Tests login functionality and role-based access
 */

const assert = require('assert')

module.exports = {
  name: 'Authentication Flow',
  
  async run(page, config) {
    // Navigate to login page
    await page.goto(config.baseURL + '/login', {
      waitUntil: 'networkidle0',
      timeout: config.timeout.navigation
    })
    
    // Test 1: Verify login page loads
    const title = await page.title()
    assert(title.includes('CostTrak'), 'Login page should load with correct title')
    
    // Test 2: Check for login form elements
    const emailInput = await page.$('input[type="email"]')
    const passwordInput = await page.$('input[type="password"]')
    const submitButton = await page.$('button[type="submit"]')
    
    assert(emailInput, 'Email input should exist')
    assert(passwordInput, 'Password input should exist')
    assert(submitButton, 'Submit button should exist')
    
    // Test 3: Test login with controller credentials
    await page.type('input[type="email"]', config.testUsers.controller.email)
    await page.type('input[type="password"]', config.testUsers.controller.password)
    
    // Click login and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ])
    
    // Test 4: Verify successful login
    const currentUrl = page.url()
    assert(
      currentUrl.includes('/dashboard') || currentUrl.includes('/projects'),
      'Should redirect to dashboard after login'
    )
    
    // Test 5: Check for user menu (indicates logged in state)
    await page.waitForSelector('[data-testid="user-menu"], button:has-text("Logout")', {
      timeout: 5000
    })
    
    // Test 6: Verify role-based navigation
    const navItems = await page.$$eval('nav a, nav button', elements => 
      elements.map(el => el.textContent.trim())
    )
    
    // Controller should see admin options
    const hasAdminOptions = navItems.some(item => 
      item.includes('Users') || item.includes('Settings')
    )
    assert(hasAdminOptions, 'Controller should see admin navigation options')
    
    // Test 7: Test logout
    const logoutButton = await page.$('button:has-text("Logout"), [data-testid="logout-button"]')
    if (logoutButton) {
      await logoutButton.click()
      await page.waitForNavigation({ waitUntil: 'networkidle0' })
      
      const afterLogoutUrl = page.url()
      assert(
        afterLogoutUrl.includes('/login'),
        'Should redirect to login page after logout'
      )
    }
    
    // Performance metrics (SuperClaude feature)
    if (config.performance.enabled) {
      const metrics = await page.metrics()
      const performanceMetrics = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0]
        return {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        }
      })
      
      console.log('  Performance Metrics:', {
        heapUsed: `${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`,
        domNodes: metrics.Nodes,
        ...performanceMetrics
      })
    }
  }
}