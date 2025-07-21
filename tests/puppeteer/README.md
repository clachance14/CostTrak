# SuperClaude E2E Testing with Puppeteer

This directory contains Puppeteer-based E2E tests that integrate with SuperClaude's testing workflow.

## Overview

SuperClaude's E2E testing capabilities use Puppeteer to provide:
- 🎯 End-to-end testing automation
- 📊 Performance metrics collection
- 🖼️ Visual regression testing
- 🔄 User interaction simulation
- 📈 Core Web Vitals measurement

## Running Tests

### Basic Commands
```bash
# Run all Puppeteer tests
pnpm test:puppeteer

# Run tests with visible browser
pnpm test:puppeteer:headed

# Run performance tests
pnpm test:puppeteer:performance
```

### SuperClaude Commands
When using SuperClaude, you can use these commands:

```bash
# Run E2E tests with Puppeteer
/test --e2e --pup

# Analyze performance metrics
/analyze --performance --pup

# Visual validation and regression testing
/scan --validate --pup

# Test with coverage analysis
/test --coverage --e2e --pup
```

## Test Structure

```
tests/puppeteer/
├── auth/                    # Authentication tests
│   └── login.test.js       # Login flow and role-based access
├── projects/               # Project management tests
├── purchase-orders/        # PO workflow tests
├── labor-forecasts/        # Labor entry tests
├── utils/                  # Test utilities
├── fixtures/               # Test data
├── screenshots/            # Failure screenshots
├── puppeteer.config.js     # Configuration
├── run-tests.js           # Test runner
└── performance-tests.js    # Performance testing suite
```

## Configuration

Edit `puppeteer.config.js` to customize:
- Browser launch options
- Viewport settings
- Timeouts
- Test user credentials
- Performance metrics

## Writing Tests

### Basic Test Structure
```javascript
module.exports = {
  name: 'Test Name',
  
  async run(page, config) {
    // Navigate to page
    await page.goto(config.baseURL + '/page')
    
    // Perform actions
    await page.click('button')
    
    // Make assertions
    const element = await page.$('.selector')
    assert(element, 'Element should exist')
    
    // Collect performance metrics
    if (config.performance.enabled) {
      const metrics = await page.metrics()
      console.log('Performance:', metrics)
    }
  }
}
```

## Performance Testing

The performance suite measures:
- **Core Web Vitals**: LCP, FID, CLS
- **Timing Metrics**: TTFB, DOMContentLoaded, Load
- **Memory Usage**: JS Heap, DOM Nodes
- **Bundle Analysis**: JS, CSS, Image sizes

### Performance Thresholds
- LCP: < 2.5s (Good)
- FID: < 100ms (Good)
- CLS: < 0.1 (Good)

## SuperClaude Integration

### With Personas
```bash
# QA-focused testing
/test --e2e --pup --persona-qa

# Performance-focused testing
/analyze --performance --pup --persona-performance

# Security-focused testing
/scan --security --pup --persona-security
```

### With Other Flags
```bash
# Detailed analysis
/test --e2e --pup --think

# Coverage report
/test --e2e --pup --coverage

# Dry run
/test --e2e --pup --dry-run
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Wait Strategies**: Use `waitForSelector` and `waitForNavigation`
3. **Error Handling**: Tests capture screenshots on failure
4. **Performance**: Monitor metrics to catch regressions
5. **Data Management**: Use test-specific data, not production

## Debugging

```bash
# Run with Chrome DevTools
DEVTOOLS=true pnpm test:puppeteer:headed

# Enable debug logging
DEBUG=true pnpm test:puppeteer

# Slow down execution
SLOW_MO=250 pnpm test:puppeteer:headed
```

## Environment Variables

Create `.env.test.local`:
```env
TEST_CONTROLLER_EMAIL=test-controller@ics.ac
TEST_CONTROLLER_PASSWORD=testpass123
TEST_PM_EMAIL=test-pm@ics.ac
TEST_PM_PASSWORD=testpass123
BASE_URL=http://localhost:3000
```

## CI/CD Integration

The tests are configured to run in CI environments with:
- Headless mode by default
- No sandbox mode for containers
- Proper error codes for build failures
- Screenshot artifacts on failures

## Troubleshooting

### Common Issues

1. **Browser won't launch**: Install system dependencies
   ```bash
   # Ubuntu/Debian
   sudo apt-get install chromium-browser
   ```

2. **Tests timeout**: Increase timeout in config or check network

3. **Screenshots not saving**: Ensure screenshots directory exists

4. **Performance metrics missing**: Some metrics require HTTPS

## Next Steps

1. Add more comprehensive test coverage
2. Implement visual regression testing
3. Set up performance budgets
4. Create data-driven test scenarios
5. Add accessibility testing

The Puppeteer tests complement the existing Playwright tests and enable full SuperClaude E2E testing capabilities.