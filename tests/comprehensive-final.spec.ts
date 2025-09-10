import { test, expect } from '@playwright/test';

test.describe('Comprehensive System Test', () => {
  test('should handle complete user journey', async ({ page }) => {
    console.log('🚀 Starting comprehensive system test...');
    
    // 1. Test main page loads
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    console.log('✅ Main page loads correctly');
    
    // 2. Test display page loads
    await page.goto('/display');
    await expect(page.locator('text=Now Playing')).toBeVisible();
    console.log('✅ Display page loads correctly');
    
    // 3. Test admin authentication
    await page.goto('/admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Song Requests')).toBeVisible();
    console.log('✅ Admin authentication works');
    
    // 4. Test admin tabs navigation
    await page.click('button:has-text("Song Requests")');
    await expect(page.locator('select')).toBeVisible();
    console.log('✅ Song Requests tab works');
    
    await page.click('button:has-text("Spotify")');
    await page.waitForTimeout(1000);
    console.log('✅ Spotify tab accessible');
    
    await page.click('button:has-text("Event Settings")');
    await expect(page.locator('input').first()).toBeVisible();
    console.log('✅ Event Settings tab works');
    
    // 5. Test Spotify setup page
    await page.goto('/admin/spotify-setup');
    await expect(page.locator('text=Spotify Setup')).toBeVisible();
    console.log('✅ Spotify setup page loads');
    
    // 6. Test route protection
    await page.evaluate(() => localStorage.removeItem('admin_token'));
    await page.goto('/admin');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    console.log('✅ Route protection works');
    
    console.log('🎉 All comprehensive tests passed!');
  });
  
  test('should handle error scenarios gracefully', async ({ page }) => {
    console.log('🔍 Testing error handling...');
    
    // Test invalid admin login
    await page.goto('/admin');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Should still show login form or error
    const stillOnLogin = await page.locator('input[type="password"]').isVisible();
    const hasError = await page.locator('text=Invalid, text=Error').isVisible();
    expect(stillOnLogin || hasError).toBe(true);
    console.log('✅ Invalid login handled correctly');
    
    // Test accessing protected routes without auth
    await page.goto('/admin/spotify-setup');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    console.log('✅ Protected route access handled correctly');
    
    console.log('🛡️ Error handling tests passed!');
  });
  
  test('should maintain responsive design', async ({ page }) => {
    console.log('📱 Testing responsive design...');
    
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Test main page
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();
      
      // Test display page
      await page.goto('/display');
      await expect(page.locator('text=Now Playing')).toBeVisible();
      
      // Test admin page
      await page.goto('/admin');
      await expect(page.locator('input[type="password"]')).toBeVisible();
      
      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}) responsive design works`);
    }
    
    console.log('📐 Responsive design tests passed!');
  });
});
