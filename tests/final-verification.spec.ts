import { test, expect } from '@playwright/test';

test.describe('Final Verification - All Issues Fixed', () => {
  test('Admin panel works without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    
    // Monitor for errors
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('DevTools')) {
        consoleErrors.push(msg.text());
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    page.on('response', async response => {
      if (response.status() >= 400) {
        const url = response.url();
        if (url.includes('/api/')) {
          networkErrors.push(`${response.status()} ${url}`);
          console.log(`❌ API Error: ${response.status()} ${url}`);
        }
      }
    });

    console.log('🚀 Starting final verification test...');

    // Navigate and login
    await page.goto('/admin');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for admin panel to load
    await page.waitForTimeout(5000);
    
    // Verify admin panel is loaded
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    console.log('✅ Admin panel loaded successfully');
    
    // Test navigation between tabs
    console.log('🔄 Testing tab navigation...');
    
    await page.click('text=Requests');
    await page.waitForTimeout(1000);
    await expect(page.getByRole('heading', { name: 'Song Requests' })).toBeVisible();
    console.log('✅ Requests tab works');
    
    await page.click('text=Queue');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Now Playing')).toBeVisible();
    console.log('✅ Queue tab works');
    
    await page.click('text=Settings');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Event Settings')).toBeVisible();
    console.log('✅ Settings tab works');
    
    await page.click('text=Overview');
    await page.waitForTimeout(1000);
    console.log('✅ Overview tab works');
    
    // Wait a bit more to catch any delayed errors
    await page.waitForTimeout(3000);
    
    // Verify no critical errors
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('Objects are not valid as a React child') ||
      error.includes('Cannot read properties of undefined') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );
    
    console.log('\n📊 FINAL RESULTS:');
    console.log('=================');
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Critical React errors: ${criticalErrors.length}`);
    console.log(`API errors: ${networkErrors.length}`);
    
    if (criticalErrors.length > 0) {
      console.log('\n❌ Critical errors found:');
      criticalErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (networkErrors.length > 0) {
      console.log('\n❌ API errors found:');
      networkErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Assertions
    expect(criticalErrors).toHaveLength(0);
    expect(networkErrors).toHaveLength(0);
    
    console.log('\n🎉 ALL TESTS PASSED! Admin panel is working correctly.');
  });
});
