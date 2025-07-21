/**
 * SuperClaude Performance Monitoring Test
 * Measures Core Web Vitals, load times, and resource usage
 */

const assert = require('assert')

module.exports = {
  name: 'Performance Monitoring',
  
  async run(page, config) {
    const performanceResults = {
      pages: {},
      resources: {},
      metrics: {}
    }
    
    // Pages to test
    const pagesToTest = [
      { name: 'Login', path: '/' },
      { name: 'Dashboard', path: '/dashboard', requiresAuth: true },
      { name: 'Projects List', path: '/projects', requiresAuth: true },
      { name: 'Purchase Orders', path: '/purchase-orders', requiresAuth: true },
      { name: 'Labor Forecasts', path: '/labor-forecasts', requiresAuth: true }
    ]
    
    // Performance thresholds (based on Core Web Vitals)
    const thresholds = {
      lcp: 2500, // Largest Contentful Paint < 2.5s
      fid: 100,  // First Input Delay < 100ms
      cls: 0.1,  // Cumulative Layout Shift < 0.1
      ttfb: 800, // Time to First Byte < 800ms
      fcp: 1800, // First Contentful Paint < 1.8s
      pageLoad: 3000, // Total page load < 3s
      jsHeap: 50 * 1024 * 1024, // JS Heap < 50MB
      domNodes: 1500 // DOM nodes < 1500
    }
    
    // Helper function to get performance metrics
    async function getPerformanceMetrics(page) {
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle')
      
      // Get navigation timing
      const navigationTiming = await page.evaluate(() => {
        const timing = performance.getEntriesByType('navigation')[0]
        return {
          ttfb: timing.responseStart - timing.requestStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
          loadComplete: timing.loadEventEnd - timing.loadEventStart,
          totalTime: timing.loadEventEnd - timing.fetchStart
        }
      })
      
      // Get paint timing
      const paintTiming = await page.evaluate(() => {
        const paints = {}
        performance.getEntriesByType('paint').forEach(entry => {
          paints[entry.name] = entry.startTime
        })
        return paints
      })
      
      // Get resource timing
      const resourceTiming = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource')
        const summary = {
          total: resources.length,
          byType: {},
          slowest: []
        }
        
        resources.forEach(resource => {
          const type = resource.initiatorType
          if (!summary.byType[type]) {
            summary.byType[type] = { count: 0, totalSize: 0, totalDuration: 0 }
          }
          summary.byType[type].count++
          summary.byType[type].totalDuration += resource.duration
          
          if (resource.duration > 500) {
            summary.slowest.push({
              name: resource.name,
              duration: resource.duration,
              size: resource.transferSize
            })
          }
        })
        
        summary.slowest.sort((a, b) => b.duration - a.duration)
        summary.slowest = summary.slowest.slice(0, 5)
        
        return summary
      })
      
      // Get memory usage
      const memoryUsage = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          }
        }
        return null
      })
      
      // Get DOM metrics
      const domMetrics = await page.evaluate(() => {
        return {
          nodeCount: document.getElementsByTagName('*').length,
          documentHeight: document.documentElement.scrollHeight,
          images: document.images.length,
          scripts: document.scripts.length,
          stylesheets: document.styleSheets.length
        }
      })
      
      // Get Core Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const metrics = {}
          
          // LCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]
            metrics.lcp = lastEntry.startTime
          }).observe({ entryTypes: ['largest-contentful-paint'] })
          
          // CLS
          let clsValue = 0
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value
              }
            }
            metrics.cls = clsValue
          }).observe({ entryTypes: ['layout-shift'] })
          
          // FID (simulated)
          metrics.fid = 0 // Will be measured on actual interaction
          
          // Resolve after a delay to collect metrics
          setTimeout(() => resolve(metrics), 2000)
        })
      })
      
      return {
        navigation: navigationTiming,
        paint: paintTiming,
        resources: resourceTiming,
        memory: memoryUsage,
        dom: domMetrics,
        webVitals: webVitals
      }
    }
    
    // Login if needed
    async function loginIfRequired() {
      await page.goto(config.baseURL)
      const isLoginPage = await page.$('input[name="email"]')
      
      if (isLoginPage) {
        await page.type('input[name="email"]', config.testUsers.controller.email)
        await page.type('input[name="password"]', config.testUsers.controller.password)
        await page.click('button[type="submit"]')
        await page.waitForNavigation()
      }
    }
    
    // Test each page
    for (const pageTest of pagesToTest) {
      console.log(`Testing performance for: ${pageTest.name}`)
      
      if (pageTest.requiresAuth) {
        await loginIfRequired()
      }
      
      const startTime = Date.now()
      await page.goto(`${config.baseURL}${pageTest.path}`)
      
      // Wait for page to stabilize
      await page.waitForTimeout(2000)
      
      const metrics = await getPerformanceMetrics(page)
      const loadTime = Date.now() - startTime
      
      performanceResults.pages[pageTest.name] = {
        loadTime,
        metrics,
        passed: true,
        failures: []
      }
      
      // Check against thresholds
      if (metrics.webVitals.lcp > thresholds.lcp) {
        performanceResults.pages[pageTest.name].passed = false
        performanceResults.pages[pageTest.name].failures.push(
          `LCP ${metrics.webVitals.lcp.toFixed(0)}ms exceeds threshold ${thresholds.lcp}ms`
        )
      }
      
      if (metrics.webVitals.cls > thresholds.cls) {
        performanceResults.pages[pageTest.name].passed = false
        performanceResults.pages[pageTest.name].failures.push(
          `CLS ${metrics.webVitals.cls.toFixed(3)} exceeds threshold ${thresholds.cls}`
        )
      }
      
      if (loadTime > thresholds.pageLoad) {
        performanceResults.pages[pageTest.name].passed = false
        performanceResults.pages[pageTest.name].failures.push(
          `Page load time ${loadTime}ms exceeds threshold ${thresholds.pageLoad}ms`
        )
      }
      
      if (metrics.memory && metrics.memory.usedJSHeapSize > thresholds.jsHeap) {
        performanceResults.pages[pageTest.name].passed = false
        performanceResults.pages[pageTest.name].failures.push(
          `JS Heap ${(metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB exceeds threshold ${(thresholds.jsHeap / 1024 / 1024)}MB`
        )
      }
      
      if (metrics.dom.nodeCount > thresholds.domNodes) {
        performanceResults.pages[pageTest.name].passed = false
        performanceResults.pages[pageTest.name].failures.push(
          `DOM nodes ${metrics.dom.nodeCount} exceeds threshold ${thresholds.domNodes}`
        )
      }
    }
    
    // Test specific interactions
    console.log('Testing interaction performance...')
    
    // Test table sorting performance
    await page.goto(`${config.baseURL}/projects`)
    await page.waitForSelector('[data-testid="projects-list"]')
    
    const sortStart = Date.now()
    await page.click('th:has-text("Job Number")')
    await page.waitForTimeout(500)
    const sortDuration = Date.now() - sortStart
    
    performanceResults.metrics.tableSort = {
      duration: sortDuration,
      passed: sortDuration < 300
    }
    
    // Test search performance
    const searchStart = Date.now()
    await page.type('input[placeholder*="Search"]', 'test project')
    await page.waitForTimeout(1000) // Wait for debounce and results
    const searchDuration = Date.now() - searchStart
    
    performanceResults.metrics.search = {
      duration: searchDuration,
      passed: searchDuration < 1500
    }
    
    // Bundle size analysis
    const coverage = await page.coverage.startJSCoverage()
    await page.goto(`${config.baseURL}/dashboard`)
    await page.waitForTimeout(2000)
    const jsCoverage = await page.coverage.stopJSCoverage()
    
    let totalBytes = 0
    let usedBytes = 0
    
    for (const entry of jsCoverage) {
      totalBytes += entry.text.length
      for (const range of entry.ranges) {
        usedBytes += range.end - range.start - 1
      }
    }
    
    performanceResults.metrics.bundleEfficiency = {
      totalKB: (totalBytes / 1024).toFixed(1),
      usedKB: (usedBytes / 1024).toFixed(1),
      percentage: ((usedBytes / totalBytes) * 100).toFixed(1),
      passed: usedBytes / totalBytes > 0.5
    }
    
    // Generate summary report
    console.log('\n=== Performance Test Summary ===')
    
    let allPassed = true
    
    for (const [pageName, results] of Object.entries(performanceResults.pages)) {
      console.log(`\n${pageName}:`)
      console.log(`  Load Time: ${results.loadTime}ms`)
      console.log(`  LCP: ${results.metrics.webVitals.lcp?.toFixed(0)}ms`)
      console.log(`  CLS: ${results.metrics.webVitals.cls?.toFixed(3)}`)
      console.log(`  Status: ${results.passed ? '✓ PASSED' : '✗ FAILED'}`)
      
      if (!results.passed) {
        allPassed = false
        console.log('  Failures:')
        results.failures.forEach(failure => {
          console.log(`    - ${failure}`)
        })
      }
    }
    
    console.log('\nInteraction Metrics:')
    console.log(`  Table Sort: ${performanceResults.metrics.tableSort.duration}ms ${performanceResults.metrics.tableSort.passed ? '✓' : '✗'}`)
    console.log(`  Search: ${performanceResults.metrics.search.duration}ms ${performanceResults.metrics.search.passed ? '✓' : '✗'}`)
    
    console.log('\nBundle Efficiency:')
    console.log(`  Total JS: ${performanceResults.metrics.bundleEfficiency.totalKB}KB`)
    console.log(`  Used JS: ${performanceResults.metrics.bundleEfficiency.usedKB}KB`)
    console.log(`  Efficiency: ${performanceResults.metrics.bundleEfficiency.percentage}%`)
    
    // Assert overall performance
    assert(allPassed, 'Performance tests failed - see failures above')
    
    // Save detailed report
    if (config.screenshot.path) {
      const fs = require('fs').promises
      const reportPath = `${config.screenshot.path}/performance-report-${Date.now()}.json`
      await fs.writeFile(reportPath, JSON.stringify(performanceResults, null, 2))
      console.log(`\nDetailed report saved to: ${reportPath}`)
    }
  }
}