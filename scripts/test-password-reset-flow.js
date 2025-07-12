#!/usr/bin/env node

const { chromium } = require('playwright');

async function testPasswordResetFlow() {
  console.log('Starting password reset flow test...');
  
  const browser = await chromium.launch({
    headless: true,
  });
  
  const page = await browser.newContext().then(context => context.newPage());
  
  try {
    // Go to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3001/login');
    await page.waitForSelector('input[type="email"]');
    
    // Click forgot password
    console.log('2. Clicking forgot password link...');
    await page.click('text=/forgot.*password/i');
    
    // Wait for navigation
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('3. Current URL:', currentUrl);
    
    if (currentUrl.includes('password-reset')) {
      console.log('✅ Successfully navigated to password reset page');
      
      // Check page content
      const pageTitle = await page.textContent('h1, h2').catch(() => null);
      console.log('Page title:', pageTitle);
      
      // Look for email input
      const hasEmailInput = await page.locator('input[type="email"]').isVisible();
      console.log('Has email input:', hasEmailInput);
      
      if (hasEmailInput) {
        // Try to submit password reset
        console.log('4. Entering email for password reset...');
        await page.fill('input[type="email"]', 'clachance@ics.ac');
        
        // Look for submit button
        const submitButton = await page.locator('button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          console.log('5. Clicking submit button...');
          await submitButton.click();
          
          // Wait for response
          await page.waitForTimeout(3000);
          
          // Check for success or error messages
          const alerts = await page.locator('[role="alert"]').all();
          for (const alert of alerts) {
            const text = await alert.textContent();
            console.log('Alert:', text);
          }
          
          const finalUrl = page.url();
          console.log('6. Final URL:', finalUrl);
        }
      }
      
      await page.screenshot({ path: 'password-reset-page.png' });
    } else {
      console.log('❌ Failed to navigate to password reset page');
      console.log('Still at:', currentUrl);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testPasswordResetFlow().catch(console.error);