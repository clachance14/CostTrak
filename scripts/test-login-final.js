#!/usr/bin/env node

const { chromium } = require('playwright');

async function testLoginFinal() {
  console.log('Testing login after user profile fix...\n');
  
  const browser = await chromium.launch({
    headless: false, // Show browser
    slowMo: 1000, // Slow down actions
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Log console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });
  
  try {
    // Navigate to login
    console.log('1. Going to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    console.log('2. Please enter your credentials manually in the browser');
    console.log('   - Use the email and password you created in Supabase Dashboard');
    console.log('   - The script will wait for you to complete the login\n');
    
    // Wait for user to login manually
    console.log('Waiting for successful login (timeout: 60 seconds)...');
    
    try {
      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard/**', { timeout: 60000 });
      
      const finalUrl = page.url();
      console.log('\n✅ Login successful!');
      console.log('Redirected to:', finalUrl);
      
      // Take screenshot of dashboard
      await page.waitForTimeout(2000); // Let page fully load
      await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true });
      console.log('Dashboard screenshot saved: dashboard-screenshot.png');
      
      // Check for user info
      const userNameElement = await page.locator('text=/C.*Lachance/i').first();
      if (await userNameElement.isVisible()) {
        const userName = await userNameElement.textContent();
        console.log('Logged in as:', userName);
      }
      
      // Check role display
      const roleElement = await page.locator('text=/controller/i').first();
      if (await roleElement.isVisible()) {
        console.log('Role:', 'Controller');
      }
      
      console.log('\n🎉 Everything is working! The CostTrak app is ready to use.');
      
    } catch (timeoutError) {
      console.log('\n❌ Login did not redirect to dashboard within 60 seconds');
      
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      // Check for errors
      const errorElements = await page.locator('[role="alert"], .text-red-600').all();
      for (const element of errorElements) {
        const text = await element.textContent();
        console.log('Error found:', text);
      }
      
      await page.screenshot({ path: 'login-error-final.png' });
      console.log('Error screenshot saved: login-error-final.png');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    console.log('\nKeeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

// Run test
testLoginFinal().catch(console.error);