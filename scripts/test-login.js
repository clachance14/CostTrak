#!/usr/bin/env node

const { chromium } = require('playwright');

async function testLogin() {
  console.log('Starting login test...');
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true, // Set to false to see the browser
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to login page
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    
    // Wait for the page to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('Login page loaded');
    
    // Fill in credentials
    console.log('Entering credentials...');
    await page.fill('input[type="email"]', 'clachance@ics.ac');
    await page.fill('input[type="password"]', 'TempPassword123!');
    
    // Take a screenshot before login
    await page.screenshot({ path: 'before-login.png' });
    console.log('Screenshot saved: before-login.png');
    
    // Click sign in button
    console.log('Clicking sign in button...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    try {
      // Wait for either successful redirect or error message
      await Promise.race([
        page.waitForURL('**/dashboard/**', { timeout: 10000 }),
        page.waitForSelector('.text-red-600', { timeout: 10000 }), // Error message
        page.waitForSelector('[role="alert"]', { timeout: 10000 }), // Alert
      ]);
      
      // Check current URL
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      // Take a screenshot after login attempt
      await page.screenshot({ path: 'after-login.png' });
      console.log('Screenshot saved: after-login.png');
      
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ Login successful! Redirected to:', currentUrl);
        
        // Get user info if visible
        const userName = await page.textContent('text=/C.*Lachance/i').catch(() => null);
        if (userName) {
          console.log('Logged in as:', userName);
        }
      } else if (currentUrl.includes('/login')) {
        console.log('❌ Still on login page');
        
        // Check for error messages
        const errorText = await page.textContent('.text-red-600').catch(() => null);
        const alertText = await page.textContent('[role="alert"]').catch(() => null);
        
        if (errorText) {
          console.log('Error message:', errorText);
        }
        if (alertText) {
          console.log('Alert message:', alertText);
        }
      }
      
      // Check console logs
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('Browser console error:', msg.text());
        }
      });
      
      // Wait a bit to catch any console errors
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.log('Timeout or error during login:', error.message);
      
      // Take error screenshot
      await page.screenshot({ path: 'error-state.png' });
      console.log('Error screenshot saved: error-state.png');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testLogin().catch(console.error);