/**
 * Puppeteer Configuration for SuperClaude E2E Testing
 */

module.exports = {
  // Test configuration
  testDir: './tests/puppeteer',
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  
  // Browser launch options
  launchOptions: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    devtools: process.env.DEVTOOLS === 'true',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },
  
  // Viewport settings
  viewport: {
    width: 1280,
    height: 720
  },
  
  // Timeouts
  timeout: {
    navigation: 30000,
    test: 60000
  },
  
  // Screenshot settings
  screenshot: {
    path: './tests/puppeteer/screenshots',
    fullPage: true,
    type: 'png'
  },
  
  // Performance metrics
  performance: {
    enabled: true,
    metrics: [
      'FirstContentfulPaint',
      'LargestContentfulPaint',
      'CumulativeLayoutShift',
      'TotalBlockingTime'
    ]
  },
  
  // Test patterns
  testMatch: [
    '**/*.test.js',
    '**/*.spec.js'
  ],
  
  // Test data
  testUsers: {
    controller: {
      email: process.env.TEST_CONTROLLER_EMAIL || 'test-controller@ics.ac',
      password: process.env.TEST_CONTROLLER_PASSWORD || 'testpass123'
    },
    projectManager: {
      email: process.env.TEST_PM_EMAIL || 'test-pm@ics.ac',
      password: process.env.TEST_PM_PASSWORD || 'testpass123'
    },
    viewer: {
      email: process.env.TEST_VIEWER_EMAIL || 'test-viewer@ics.ac',
      password: process.env.TEST_VIEWER_PASSWORD || 'testpass123'
    }
  }
}