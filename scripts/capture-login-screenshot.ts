import { chromium } from 'playwright';

async function captureLoginScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({
      path: 'login-page-screenshot.png',
      fullPage: true
    });
    
    console.log('Screenshot saved as login-page-screenshot.png');
  } catch (error) {
    console.error('Error capturing screenshot:', error);
  } finally {
    await browser.close();
  }
}

captureLoginScreenshot();