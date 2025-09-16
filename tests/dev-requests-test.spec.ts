import { test, expect } from '@playwright/test';

test.describe('Dev Requests Test', () => {
  
  test('Requests page works in development without map errors', async ({ page }) => {
    console.log('🔧 Testing requests page in development...');
    
    // Capture console errors specifically
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Also capture page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    // Login to admin
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await page.waitForURL('**/admin/overview');
    
    console.log('✅ Admin login successful');
    
    // Navigate to requests page
    await page.goto('http://localhost:3000/admin/requests');
    await page.waitForTimeout(3000);
    
    console.log('✅ Navigated to requests page');
    
    // Check for the specific map error
    const mapErrors = [...errors, ...pageErrors].filter(error => 
      error.includes('requestsData.map is not a function') ||
      error.includes('.map is not a function')
    );
    
    console.log(`❌ Map errors found: ${mapErrors.length}`);
    console.log(`📊 Total console errors: ${errors.length}`);
    console.log(`📊 Total page errors: ${pageErrors.length}`);
    
    if (mapErrors.length > 0) {
      console.log('🔍 Map errors:', mapErrors);
    }
    
    if (errors.length > 0) {
      console.log('🔍 Console errors:', errors);
    }
    
    if (pageErrors.length > 0) {
      console.log('🔍 Page errors:', pageErrors);
    }
    
    // Check page loads
    await expect(page.locator('body')).toBeVisible();
    
    // Main test - no map errors
    expect(mapErrors.length).toBe(0);
    
    console.log('🎉 Dev requests test PASSED - no map errors!');
  });
});
