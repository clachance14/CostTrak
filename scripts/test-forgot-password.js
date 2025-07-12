#!/usr/bin/env node

const { chromium } = require('playwright');

async function testForgotPassword() {
  console.log('Starting forgot password test...');
  
  // Launch browser with visible window
  const browser = await chromium.launch({
    headless: false, // Show the browser
    slowMo: 500, // Slow down actions by 500ms
  });
  
  const context = await browser.newContext({
    // Record video
    recordVideo: {
      dir: './videos/',
    },
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('Browser console:', msg.type(), msg.text());
  });
  
  // Log network requests
  page.on('request', request => {
    if (request.url().includes('/api/') || request.url().includes('supabase')) {
      console.log('Network request:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/') || response.url().includes('supabase')) {
      console.log('Network response:', response.status(), response.url());
    }
  });
  
  try {
    // Go to login page
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    
    // Wait for the page to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('Login page loaded');
    
    // Take initial screenshot
    await page.screenshot({ path: 'forgot-password-1-initial.png' });
    
    // Find and click the "Forgot your password?" link
    console.log('Looking for forgot password link...');
    const forgotPasswordLink = await page.locator('text=/forgot.*password/i');
    
    if (await forgotPasswordLink.isVisible()) {
      console.log('Found forgot password link, clicking...');
      
      // Take screenshot before click
      await page.screenshot({ path: 'forgot-password-2-before-click.png' });
      
      // Click with force to ensure it works
      await forgotPasswordLink.click({ force: true });
      
      console.log('Clicked forgot password link');
      
      // Wait for navigation or any changes
      await page.waitForTimeout(2000);
      
      // Take screenshot after click
      await page.screenshot({ path: 'forgot-password-3-after-click.png' });
      
      // Check current URL
      const currentUrl = page.url();
      console.log('Current URL after click:', currentUrl);
      
      // Check if we're on password reset page
      if (currentUrl.includes('password-reset')) {
        console.log('✅ Successfully navigated to password reset page');
        
        // Look for email input on reset page
        const resetEmailInput = await page.locator('input[type="email"]').first();
        if (await resetEmailInput.isVisible()) {
          console.log('Found email input on reset page');
          await page.screenshot({ path: 'forgot-password-4-reset-page.png' });
        }
      } else if (currentUrl.includes('login')) {
        console.log('❌ Still on login page or redirected back');
        
        // Check for any error messages
        const alerts = await page.locator('[role="alert"]').all();
        for (const alert of alerts) {
          const text = await alert.textContent();
          console.log('Alert found:', text);
        }
      }
      
      // Wait to see any redirects
      console.log('Waiting 5 seconds to observe any redirects...');
      await page.waitForTimeout(5000);
      
      const finalUrl = page.url();
      console.log('Final URL:', finalUrl);
      await page.screenshot({ path: 'forgot-password-5-final.png' });
      
    } else {
      console.log('❌ Could not find forgot password link');
      
      // Try to find it by other selectors
      const allLinks = await page.locator('a').all();
      console.log('All links on page:');
      for (const link of allLinks) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        console.log(`  - "${text}" -> ${href}`);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'forgot-password-error.png' });
  } finally {
    console.log('Closing browser in 10 seconds...');
    await page.waitForTimeout(10000);
    await context.close();
    await browser.close();
  }
}

// Run the test
testForgotPassword().catch(console.error);