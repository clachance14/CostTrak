#!/usr/bin/env node

/**
 * Performance Testing Suite for SuperClaude
 * Measures Core Web Vitals and custom metrics
 */

const puppeteer = require('puppeteer')
const config = require('./puppeteer.config')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m'
}

class PerformanceTester {
  constructor() {
    this.results = []
  }

  async measurePagePerformance(page, url, name) {
    console.log(`\n${colors.blue}📊 Measuring: ${name}${colors.reset}`)
    console.log(`${colors.dim}URL: ${url}${colors.reset}`)
    
    // Enable performance metrics
    await page.evaluateOnNewDocument(() => {
      window.performanceMetrics = {
        start: Date.now(),
        marks: []
      }
    })
    
    // Navigate and measure
    const startTime = Date.now()
    await page.goto(url, { waitUntil: 'networkidle0' })
    const loadTime = Date.now() - startTime
    
    // Collect Core Web Vitals
    const coreWebVitals = await page.evaluate(() => {
      return new Promise(resolve => {
        let lcp = 0
        let fid = 0
        let cls = 0
        
        // Largest Contentful Paint
        new PerformanceObserver(entryList => {
          const entries = entryList.getEntries()
          const lastEntry = entries[entries.length - 1]
          lcp = lastEntry.renderTime || lastEntry.loadTime
        }).observe({ entryTypes: ['largest-contentful-paint'] })
        
        // First Input Delay (simulated)
        if (window.PerformanceEventTiming) {
          new PerformanceObserver(entryList => {
            const firstInput = entryList.getEntries()[0]
            fid = firstInput.processingStart - firstInput.startTime
          }).observe({ entryTypes: ['first-input'] })
        }
        
        // Cumulative Layout Shift
        new PerformanceObserver(entryList => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value
            }
          }
        }).observe({ entryTypes: ['layout-shift'] })
        
        // Wait for metrics to be collected
        setTimeout(() => {
          resolve({
            LCP: lcp,
            FID: fid,
            CLS: cls.toFixed(3)
          })
        }, 2000)
      })
    })
    
    // Get additional performance metrics
    const performanceMetrics = await page.metrics()
    const performanceTiming = await page.evaluate(() => {
      const timing = performance.timing
      return {
        TTFB: timing.responseStart - timing.fetchStart,
        DOMContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        Load: timing.loadEventEnd - timing.navigationStart,
        FirstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        FCP: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      }
    })
    
    // Memory usage
    const memoryUsage = {
      JSHeapUsed: (performanceMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2),
      JSHeapTotal: (performanceMetrics.JSHeapTotalSize / 1024 / 1024).toFixed(2),
      DOMNodes: performanceMetrics.Nodes,
      LayoutCount: performanceMetrics.LayoutCount
    }
    
    // Bundle size analysis
    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      const jsSize = resources
        .filter(r => r.name.endsWith('.js'))
        .reduce((total, r) => total + r.transferSize, 0)
      const cssSize = resources
        .filter(r => r.name.endsWith('.css'))
        .reduce((total, r) => total + r.transferSize, 0)
      const imageSize = resources
        .filter(r => r.initiatorType === 'img')
        .reduce((total, r) => total + r.transferSize, 0)
      
      return {
        totalResources: resources.length,
        jsSize: (jsSize / 1024).toFixed(2),
        cssSize: (cssSize / 1024).toFixed(2),
        imageSize: (imageSize / 1024).toFixed(2),
        totalSize: ((jsSize + cssSize + imageSize) / 1024).toFixed(2)
      }
    })
    
    const result = {
      name,
      url,
      loadTime,
      coreWebVitals,
      timing: performanceTiming,
      memory: memoryUsage,
      resources: resourceMetrics
    }
    
    this.results.push(result)
    this.printMetrics(result)
    
    return result
  }

  printMetrics(metrics) {
    console.log(`\n${colors.green}Core Web Vitals:${colors.reset}`)
    console.log(`  LCP: ${this.formatMetric(metrics.coreWebVitals.LCP, 'ms', 2500)}`)
    console.log(`  FID: ${this.formatMetric(metrics.coreWebVitals.FID, 'ms', 100)}`)
    console.log(`  CLS: ${this.formatMetric(metrics.coreWebVitals.CLS, '', 0.1)}`)
    
    console.log(`\n${colors.blue}Performance Timing:${colors.reset}`)
    console.log(`  TTFB: ${metrics.timing.TTFB}ms`)
    console.log(`  DOM Content Loaded: ${metrics.timing.DOMContentLoaded}ms`)
    console.log(`  Full Page Load: ${metrics.timing.Load}ms`)
    console.log(`  First Paint: ${metrics.timing.FirstPaint.toFixed(0)}ms`)
    console.log(`  First Contentful Paint: ${metrics.timing.FCP.toFixed(0)}ms`)
    
    console.log(`\n${colors.yellow}Memory Usage:${colors.reset}`)
    console.log(`  JS Heap: ${metrics.memory.JSHeapUsed}MB / ${metrics.memory.JSHeapTotal}MB`)
    console.log(`  DOM Nodes: ${metrics.memory.DOMNodes}`)
    console.log(`  Layout Count: ${metrics.memory.LayoutCount}`)
    
    console.log(`\n${colors.dim}Bundle Analysis:${colors.reset}`)
    console.log(`  Total Resources: ${metrics.resources.totalResources}`)
    console.log(`  JavaScript: ${metrics.resources.jsSize}KB`)
    console.log(`  CSS: ${metrics.resources.cssSize}KB`)
    console.log(`  Images: ${metrics.resources.imageSize}KB`)
    console.log(`  Total Size: ${metrics.resources.totalSize}KB`)
  }

  formatMetric(value, unit, threshold) {
    const num = parseFloat(value)
    const color = num <= threshold ? colors.green : colors.red
    return `${color}${value}${unit}${colors.reset}`
  }

  async runPerformanceTests() {
    console.log(`${colors.blue}🚀 SuperClaude Performance Testing Suite${colors.reset}`)
    console.log('='.repeat(50))
    
    const browser = await puppeteer.launch(config.launchOptions)
    
    try {
      const page = await browser.newPage()
      await page.setViewport(config.viewport)
      
      // Test key pages
      const pagesToTest = [
        { url: config.baseURL + '/login', name: 'Login Page' },
        { url: config.baseURL + '/projects', name: 'Projects List' },
        { url: config.baseURL + '/dashboard', name: 'Dashboard' },
      ]
      
      for (const pageTest of pagesToTest) {
        await this.measurePagePerformance(page, pageTest.url, pageTest.name)
      }
      
      // Generate summary report
      this.generateSummary()
      
    } finally {
      await browser.close()
    }
  }

  generateSummary() {
    console.log('\n' + '='.repeat(50))
    console.log(`${colors.blue}📈 Performance Summary${colors.reset}`)
    console.log('='.repeat(50))
    
    const avgLCP = this.results.reduce((sum, r) => sum + parseFloat(r.coreWebVitals.LCP), 0) / this.results.length
    const avgCLS = this.results.reduce((sum, r) => sum + parseFloat(r.coreWebVitals.CLS), 0) / this.results.length
    const avgLoad = this.results.reduce((sum, r) => sum + r.timing.Load, 0) / this.results.length
    
    console.log(`\nAverage Metrics:`)
    console.log(`  LCP: ${this.formatMetric(avgLCP.toFixed(0), 'ms', 2500)}`)
    console.log(`  CLS: ${this.formatMetric(avgCLS.toFixed(3), '', 0.1)}`)
    console.log(`  Page Load: ${avgLoad.toFixed(0)}ms`)
    
    // Recommendations
    console.log(`\n${colors.yellow}Recommendations:${colors.reset}`)
    if (avgLCP > 2500) {
      console.log('  ⚠️  Optimize Largest Contentful Paint (target < 2.5s)')
    }
    if (avgCLS > 0.1) {
      console.log('  ⚠️  Reduce Cumulative Layout Shift (target < 0.1)')
    }
    
    const totalBundleSize = this.results.reduce((sum, r) => sum + parseFloat(r.resources.totalSize), 0)
    if (totalBundleSize > 1000) {
      console.log('  ⚠️  Consider code splitting to reduce bundle size')
    }
    
    console.log('\n✨ Performance test complete!')
  }
}

// Run performance tests
if (require.main === module) {
  const tester = new PerformanceTester()
  tester.runPerformanceTests().catch(console.error)
}

module.exports = PerformanceTester