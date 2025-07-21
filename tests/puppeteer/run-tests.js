#!/usr/bin/env node

const puppeteer = require('puppeteer')
const fs = require('fs').promises
const path = require('path')
const config = require('./puppeteer.config')

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m'
}

// Test runner class
class PuppeteerTestRunner {
  constructor() {
    this.browser = null
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    }
  }

  async setup() {
    console.log(`${colors.blue}🚀 Starting Puppeteer Test Runner${colors.reset}`)
    console.log(`${colors.dim}Base URL: ${config.baseURL}${colors.reset}`)
    
    this.browser = await puppeteer.launch(config.launchOptions)
    
    // Ensure screenshot directory exists
    await fs.mkdir(config.screenshot.path, { recursive: true })
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close()
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50))
    console.log(`${colors.blue}📊 Test Summary${colors.reset}`)
    console.log('='.repeat(50))
    console.log(`${colors.green}✓ Passed: ${this.results.passed}${colors.reset}`)
    console.log(`${colors.red}✗ Failed: ${this.results.failed}${colors.reset}`)
    console.log(`${colors.yellow}○ Skipped: ${this.results.skipped}${colors.reset}`)
    console.log('='.repeat(50))
    
    // Exit with error code if tests failed
    if (this.results.failed > 0) {
      process.exit(1)
    }
  }

  async runTest(testFile) {
    const testName = path.basename(testFile, '.js')
    console.log(`\n${colors.blue}Running: ${testName}${colors.reset}`)
    
    try {
      const page = await this.browser.newPage()
      await page.setViewport(config.viewport)
      
      // Set up console message handling
      page.on('console', msg => {
        if (process.env.DEBUG) {
          console.log(`${colors.dim}[Browser]: ${msg.text()}${colors.reset}`)
        }
      })
      
      // Load and run test
      const test = require(testFile)
      const startTime = Date.now()
      
      await test.run(page, config)
      
      const duration = Date.now() - startTime
      console.log(`${colors.green}✓ ${testName} (${duration}ms)${colors.reset}`)
      
      this.results.passed++
      this.results.tests.push({
        name: testName,
        status: 'passed',
        duration
      })
      
      await page.close()
    } catch (error) {
      console.log(`${colors.red}✗ ${testName}${colors.reset}`)
      console.log(`${colors.red}  Error: ${error.message}${colors.reset}`)
      
      // Take screenshot on failure
      try {
        const page = await this.browser.newPage()
        await page.goto(config.baseURL)
        const screenshotPath = path.join(config.screenshot.path, `${testName}-failure.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        console.log(`${colors.dim}  Screenshot saved: ${screenshotPath}${colors.reset}`)
        await page.close()
      } catch (screenshotError) {
        console.log(`${colors.dim}  Failed to capture screenshot${colors.reset}`)
      }
      
      this.results.failed++
      this.results.tests.push({
        name: testName,
        status: 'failed',
        error: error.message
      })
    }
  }

  async findTests() {
    const testFiles = []
    
    async function scanDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await scanDir(fullPath)
        } else if (entry.isFile() && config.testMatch.some(pattern => 
          entry.name.match(new RegExp(pattern.replace('**/', '').replace('*', '.*')))
        )) {
          testFiles.push(fullPath)
        }
      }
    }
    
    await scanDir(__dirname)
    return testFiles
  }

  async run() {
    try {
      await this.setup()
      
      const testFiles = await this.findTests()
      console.log(`${colors.dim}Found ${testFiles.length} test files${colors.reset}`)
      
      for (const testFile of testFiles) {
        await this.runTest(testFile)
      }
      
      await this.teardown()
    } catch (error) {
      console.error(`${colors.red}Test runner error: ${error.message}${colors.reset}`)
      process.exit(1)
    }
  }
}

// Run tests
if (require.main === module) {
  const runner = new PuppeteerTestRunner()
  runner.run()
}

module.exports = PuppeteerTestRunner