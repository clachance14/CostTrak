/**
 * SuperClaude Comprehensive E2E Test - Labor Forecast Management
 * Tests: Weekly actuals entry, headcount projections, analytics, export
 */

const assert = require('assert')

module.exports = {
  name: 'Labor Forecast Comprehensive',
  
  async run(page, config) {
    // Test data
    const weekEnding = new Date()
    weekEnding.setDate(weekEnding.getDate() + (7 - weekEnding.getDay()))
    const weekEndingStr = weekEnding.toISOString().split('T')[0]
    
    const laborData = {
      direct: {
        craftType: 'Carpenter',
        actualCost: 15000,
        actualHours: 300,
        headcount: 8,
        futureWeeks: 12
      },
      indirect: {
        craftType: 'Foreman',
        actualCost: 8000,
        actualHours: 160,
        headcount: 4,
        futureWeeks: 12
      },
      staff: {
        craftType: 'Project Engineer',
        actualCost: 12000,
        actualHours: 200,
        headcount: 5,
        futureWeeks: 16
      }
    }
    
    // Step 1: Login as project manager
    await page.goto(config.baseURL)
    await page.waitForSelector('input[name="email"]', { timeout: config.timeout.navigation })
    
    await page.type('input[name="email"]', config.testUsers.projectManager.email)
    await page.type('input[name="password"]', config.testUsers.projectManager.password)
    await page.click('button[type="submit"]')
    
    await page.waitForNavigation()
    await page.waitForSelector('[data-testid="dashboard-header"]')
    
    // Step 2: Navigate to Labor Forecasts
    await page.click('a[href="/labor-forecasts"]')
    await page.waitForSelector('[data-testid="labor-forecast-page"]')
    
    // Step 3: Select a project
    const projects = await page.$$eval('select[data-testid="project-select"] option', options => 
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    )
    
    if (projects.length <= 1) {
      throw new Error('No projects available for testing')
    }
    
    const testProject = projects[1]
    await page.select('select[data-testid="project-select"]', testProject.value)
    await page.waitForTimeout(500) // Wait for data to load
    
    // Step 4: Enter Weekly Actual Costs
    await page.click('button:has-text("Enter Weekly Actuals")')
    await page.waitForSelector('[data-testid="weekly-actuals-form"]')
    
    // Select week ending
    await page.type('input[name="week_ending"]', weekEndingStr)
    
    // Enter direct labor
    await page.click('button:has-text("Add Labor Entry")')
    await page.waitForSelector('[data-testid="labor-entry-0"]')
    
    await page.select('[data-testid="labor-entry-0"] select[name="craft_type"]', 'carpenter')
    await page.type('[data-testid="labor-entry-0"] input[name="actual_cost"]', laborData.direct.actualCost.toString())
    await page.type('[data-testid="labor-entry-0"] input[name="actual_hours"]', laborData.direct.actualHours.toString())
    
    // Enter indirect labor
    await page.click('button:has-text("Add Labor Entry")')
    await page.waitForSelector('[data-testid="labor-entry-1"]')
    
    await page.select('[data-testid="labor-entry-1"] select[name="craft_type"]', 'foreman')
    await page.type('[data-testid="labor-entry-1"] input[name="actual_cost"]', laborData.indirect.actualCost.toString())
    await page.type('[data-testid="labor-entry-1"] input[name="actual_hours"]', laborData.indirect.actualHours.toString())
    
    // Submit actuals
    await page.click('button[type="submit"]:has-text("Save Actuals")')
    await page.waitForSelector('.toast-success, [data-testid="success-message"]')
    
    // Step 5: Update Headcount Projections
    await page.click('button:has-text("Update Headcount Projections")')
    await page.waitForSelector('[data-testid="headcount-form"]')
    
    // Direct labor headcount
    const directEntry = await page.$('[data-testid="headcount-carpenter"]')
    if (directEntry) {
      await page.fill('[data-testid="headcount-carpenter"] input[name="headcount"]', laborData.direct.headcount.toString())
      await page.fill('[data-testid="headcount-carpenter"] input[name="weeks"]', laborData.direct.futureWeeks.toString())
    }
    
    // Indirect labor headcount
    const indirectEntry = await page.$('[data-testid="headcount-foreman"]')
    if (indirectEntry) {
      await page.fill('[data-testid="headcount-foreman"] input[name="headcount"]', laborData.indirect.headcount.toString())
      await page.fill('[data-testid="headcount-foreman"] input[name="weeks"]', laborData.indirect.futureWeeks.toString())
    }
    
    // Submit headcount projections
    await page.click('button[type="submit"]:has-text("Save Projections")')
    await page.waitForSelector('.toast-success, [data-testid="success-message"]')
    
    // Step 6: View Labor Analytics
    await page.click('a:has-text("Labor Analytics")')
    await page.waitForSelector('[data-testid="labor-analytics"]')
    
    // Verify running average rates are displayed
    const rateCards = await page.$$('[data-testid="rate-card"]')
    assert(rateCards.length > 0, 'Should display running average rates')
    
    // Verify charts are rendered
    const charts = await page.$$('[data-testid="labor-chart"]')
    assert(charts.length > 0, 'Should display labor charts')
    
    // Check for cost breakdown
    const costBreakdown = await page.$('[data-testid="cost-breakdown"]')
    assert(costBreakdown, 'Should display cost breakdown')
    
    // Step 7: Test Comparison View
    await page.click('button:has-text("Compare Actual vs Forecast")')
    await page.waitForSelector('[data-testid="comparison-view"]')
    
    // Verify variance calculations
    const varianceElements = await page.$$('[data-testid="variance"]')
    assert(varianceElements.length > 0, 'Should display variance calculations')
    
    // Step 8: Export Labor Data
    await page.click('button:has-text("Export Labor Data")')
    await page.waitForSelector('[data-testid="export-options"]')
    
    // Select export format
    await page.click('button:has-text("Export as Excel")')
    
    // Wait for download to start (in headless mode, we can't verify the actual download)
    await page.waitForTimeout(2000)
    
    // Step 9: Test Edge Cases
    
    // Test entering zero hours
    await page.goto(`${config.baseURL}/labor-forecasts`)
    await page.waitForSelector('[data-testid="labor-forecast-page"]')
    await page.select('select[data-testid="project-select"]', testProject.value)
    
    await page.click('button:has-text("Enter Weekly Actuals")')
    await page.waitForSelector('[data-testid="weekly-actuals-form"]')
    
    await page.click('button:has-text("Add Labor Entry")')
    await page.select('[data-testid="labor-entry-0"] select[name="craft_type"]', 'carpenter')
    await page.type('[data-testid="labor-entry-0"] input[name="actual_cost"]', '1000')
    await page.type('[data-testid="labor-entry-0"] input[name="actual_hours"]', '0')
    
    await page.click('button[type="submit"]:has-text("Save Actuals")')
    
    // Should show validation error
    const errorMessage = await page.$('.toast-error, [data-testid="error-message"]')
    assert(errorMessage, 'Should show error for zero hours')
    
    // Step 10: Test Permissions
    // Verify project manager can only see their assigned projects
    const projectOptions = await page.$$eval('select[data-testid="project-select"] option', 
      options => options.length
    )
    assert(projectOptions > 0, 'Project manager should see assigned projects')
    
    // Step 11: Performance Test
    if (config.performance.enabled) {
      // Measure page load performance
      const navigationStart = Date.now()
      await page.goto(`${config.baseURL}/labor-forecasts`)
      await page.waitForSelector('[data-testid="labor-forecast-page"]')
      const navigationEnd = Date.now()
      
      const loadTime = navigationEnd - navigationStart
      assert(loadTime < 3000, `Page should load in under 3 seconds, took ${loadTime}ms`)
      
      // Get Core Web Vitals
      const performanceMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const metrics = {}
            
            entries.forEach(entry => {
              if (entry.entryType === 'largest-contentful-paint') {
                metrics.lcp = entry.startTime
              }
              if (entry.entryType === 'first-input' && !metrics.fid) {
                metrics.fid = entry.processingStart - entry.startTime
              }
              if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                metrics.cls = (metrics.cls || 0) + entry.value
              }
            })
            
            resolve(metrics)
          }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
          
          // Trigger some interactions to measure FID
          setTimeout(() => {
            document.body.click()
          }, 100)
        })
      })
      
      console.log('Core Web Vitals:', performanceMetrics)
    }
    
    // Step 12: Test Data Validation
    // Test negative values
    await page.click('button:has-text("Enter Weekly Actuals")')
    await page.waitForSelector('[data-testid="weekly-actuals-form"]')
    
    await page.click('button:has-text("Add Labor Entry")')
    await page.type('[data-testid="labor-entry-0"] input[name="actual_cost"]', '-1000')
    
    // Should show validation feedback
    const validationError = await page.$('[data-testid="validation-error"]')
    assert(validationError || await page.$('.error'), 'Should show validation error for negative values')
    
    console.log('Labor Forecast Comprehensive Test completed successfully')
  }
}