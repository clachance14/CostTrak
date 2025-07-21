# Playwright E2E Tests for CostTrak

This directory contains end-to-end tests for the CostTrak application using Playwright.

## Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run tests in UI mode (recommended for development)
pnpm test:e2e:ui

# Debug tests
pnpm test:e2e:debug

# Run tests with visible browser
pnpm test:e2e:headed

# View test report after running tests
pnpm test:e2e:report
```

## Test Structure

```
tests/e2e/
├── auth/                 # Authentication tests
│   └── login.spec.ts    # Login/logout functionality
├── projects/            # Project management tests
│   └── projects-crud.spec.ts
├── purchase-orders/     # Purchase order tests
│   └── po-management.spec.ts
├── labor-forecasts/     # Labor forecast tests
│   └── labor-entry.spec.ts
├── utils/               # Test utilities
│   └── auth.helper.ts   # Authentication helpers
└── fixtures/            # Test fixtures and data
```

## Environment Setup

Create a `.env.test.local` file with test credentials:

```env
TEST_USER_EMAIL=test@ics.ac
TEST_USER_PASSWORD=your_test_password
```

## Configuring Playwright MCP for Claude Desktop

The SuperClaude configuration mentions Puppeteer MCP, but since you're using Playwright, here's how to configure it:

### Option 1: Use Puppeteer MCP with Playwright

The Puppeteer MCP can work with Playwright tests since they share similar APIs. To configure:

1. Open Claude Desktop Settings → Developer → MCP Servers
2. Ensure the Puppeteer server is configured:

```json
{
  "puppeteer": {
    "command": "npx",
    "args": [
      "@modelcontextprotocol/server-puppeteer"
    ]
  }
}
```

3. Restart Claude Desktop

### Option 2: Create Custom Playwright MCP Configuration

If you need specific Playwright functionality, you can create a custom MCP server. For now, the existing Puppeteer MCP should work for basic browser automation needs.

### Using MCP in Claude

Once configured, you can use commands like:
- `/test --e2e --pup` - Run E2E tests
- `/analyze --performance --pup` - Analyze performance
- `/scan --validate --pup` - Visual validation

## Writing New Tests

1. Create test files in the appropriate directory
2. Use the auth helper for tests requiring authentication
3. Follow the existing patterns for consistency
4. Use data-testid attributes for reliable element selection

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Wait Strategies**: Use `waitForLoadState('networkidle')` after navigation
3. **Selectors**: Prefer data-testid attributes over CSS selectors
4. **Assertions**: Use Playwright's built-in expect assertions
5. **Error Handling**: Tests should handle both success and failure cases

## Debugging Tests

- Use `page.pause()` to pause execution
- Enable headed mode to see the browser
- Use the Playwright Inspector with `--debug`
- Check test reports for screenshots and traces