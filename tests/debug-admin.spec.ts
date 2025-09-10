import { test, expect } from '@playwright/test';

test.describe('Admin Panel Debug', () => {
  test('Debug API and React issues', async ({ page }) => {
    // Capture all console messages
    const consoleMessages: string[] = [];
    const networkErrors: string[] = [];
    const networkResponses: { url: string, status: number, body?: string }[] = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      console.log(`Console: [${msg.type()}] ${text}`);
    });

    page.on('response', async response => {
      const url = response.url();
      const status = response.status();
      
      if (status >= 400) {
        let body = '';
        try {
          body = await response.text();
        } catch (e) {
          body = 'Could not read response body';
        }
        networkErrors.push(`${status} ${url}: ${body}`);
        networkResponses.push({ url, status, body });
        console.log(`Network Error: ${status} ${url}`);
        if (body) console.log(`Response Body: ${body}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`Page Error: ${error.message}`);
      consoleMessages.push(`[pageerror] ${error.message}`);
    });

    console.log('🚀 Starting admin panel debug test...');

    // Navigate to admin page
    console.log('📍 Navigating to /admin...');
    await page.goto('http://localhost:3000/admin');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    console.log('🔐 Attempting login...');
    // Check if login form is visible
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    
    // Login
    await passwordInput.fill('admin123');
    await page.click('button[type="submit"]');
    
    console.log('⏳ Waiting for login to complete...');
    await page.waitForTimeout(8000); // Wait longer for API calls
    
    console.log('📊 Checking for admin dashboard elements...');
    
    // Check if we can see admin elements (use more specific selectors)
    try {
      await expect(page.locator('[data-testid="overview-tab"], button:has-text("Overview")').first()).toBeVisible({ timeout: 10000 });
      console.log('✅ Admin dashboard loaded successfully');
    } catch (e) {
      console.log('❌ Admin dashboard failed to load');
      console.log('Current URL:', await page.url());
      console.log('Page title:', await page.title());
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-admin-failed.png', fullPage: true });
    }

    // Check for specific React errors
    const reactErrors = consoleMessages.filter(msg => 
      msg.includes('Objects are not valid as a React child') ||
      msg.includes('Cannot read properties of undefined') ||
      msg.includes('TypeError') ||
      msg.includes('ReferenceError')
    );

    // Check for API errors
    const apiErrors = networkErrors.filter(error => error.includes('/api/'));

    console.log('\n📋 DEBUG SUMMARY:');
    console.log('================');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`React errors: ${reactErrors.length}`);
    console.log(`API errors: ${apiErrors.length}`);
    console.log(`Network errors: ${networkErrors.length}`);

    if (reactErrors.length > 0) {
      console.log('\n🐛 REACT ERRORS:');
      reactErrors.forEach(error => console.log(`  - ${error}`));
    }

    if (apiErrors.length > 0) {
      console.log('\n🌐 API ERRORS:');
      apiErrors.forEach(error => console.log(`  - ${error}`));
    }

    if (networkErrors.length > 0) {
      console.log('\n📡 ALL NETWORK ERRORS:');
      networkErrors.forEach(error => console.log(`  - ${error}`));
    }

    // Log some successful responses too
    const successfulApiCalls = networkResponses.filter(r => r.url.includes('/api/') && r.status < 400);
    if (successfulApiCalls.length > 0) {
      console.log('\n✅ SUCCESSFUL API CALLS:');
      successfulApiCalls.forEach(call => console.log(`  - ${call.status} ${call.url}`));
    }

    // Take a final screenshot
    await page.screenshot({ path: 'debug-admin-final.png', fullPage: true });

    console.log('\n📸 Screenshots saved: debug-admin-failed.png, debug-admin-final.png');
    console.log('🏁 Debug test completed');
  });
});
