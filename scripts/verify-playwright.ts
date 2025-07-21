#!/usr/bin/env npx tsx

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

console.log('🎭 Verifying Playwright Installation\n')

// Check if Playwright is installed
try {
  const playwrightVersion = execSync('npx playwright --version', { encoding: 'utf8' })
  console.log('✅ Playwright installed:', playwrightVersion.trim())
} catch (error) {
  console.error('❌ Playwright not found. Run: pnpm install')
  process.exit(1)
}

// Check for playwright.config.ts
const configPath = path.join(process.cwd(), 'playwright.config.ts')
if (fs.existsSync(configPath)) {
  console.log('✅ Playwright config found: playwright.config.ts')
} else {
  console.log('❌ Playwright config not found')
}

// Check for test files
const testDir = path.join(process.cwd(), 'tests/e2e')
if (fs.existsSync(testDir)) {
  const testFiles = execSync('find tests/e2e -name "*.spec.ts" | wc -l', { encoding: 'utf8' })
  console.log(`✅ Test files found: ${testFiles.trim()} test specs`)
} else {
  console.log('❌ Test directory not found')
}

console.log('\n📋 MCP Configuration Instructions\n')

console.log('The Playwright MCP is referenced in your SuperClaude configuration.')
console.log('However, the standard MCP servers don\'t include a dedicated Playwright server.\n')

console.log('You have three options:\n')

console.log('1. Use the Puppeteer MCP (Recommended):')
console.log('   The Puppeteer MCP can work with Playwright for browser automation.')
console.log('   Configure it in Claude Desktop Settings → Developer → MCP Servers:\n')

const puppeteerConfig = {
  puppeteer: {
    command: 'npx',
    args: ['@modelcontextprotocol/server-puppeteer']
  }
}

console.log(JSON.stringify(puppeteerConfig, null, 2))

console.log('\n2. Run tests directly with Bash commands:')
console.log('   - pnpm test:e2e')
console.log('   - pnpm test:e2e:ui')
console.log('   - pnpm test:e2e:debug')

console.log('\n3. Create a custom Playwright MCP server:')
console.log('   This would require developing a custom MCP server specifically for Playwright.')
console.log('   See: https://modelcontextprotocol.io/docs/concepts/servers\n')

console.log('🚀 Quick Test:')
console.log('Run the following command to verify Playwright is working:')
console.log('pnpm test:e2e --project=chromium tests/e2e/auth/login.spec.ts\n')