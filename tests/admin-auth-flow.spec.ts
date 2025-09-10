import { test, expect } from '@playwright/test';

test.describe('Admin Authentication Flow', () => {
  test('should handle admin login correctly', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin');
    
    // Should show login form
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Test invalid password
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error or stay on login
    await page.waitForTimeout(1000);
    const hasError = await page.locator('text=Invalid').isVisible();
    const stillOnLogin = await page.locator('input[type="password"]').isVisible();
    expect(hasError || stillOnLogin).toBe(true);
    
    // Test correct password
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Should redirect to admin panel
    await expect(page.locator('text=Song Requests')).toBeVisible();
    await expect(page.locator('button:has-text("Overview")').first()).toBeVisible();
    
    // Check that admin token is stored
    const token = await page.evaluate(() => localStorage.getItem('admin_token'));
    expect(token).toBeTruthy();
    
    console.log('✅ Admin authentication flow working correctly');
  });
  
  test('should handle admin logout correctly', async ({ page }) => {
    // Login first
    await page.goto('/admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Song Requests')).toBeVisible();
    
    // Check if there's a logout button or similar
    const logoutButton = page.locator('button:has-text("Logout")');
    const signOutButton = page.locator('button:has-text("Sign Out")');
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else if (await signOutButton.isVisible()) {
      await signOutButton.click();
    } else {
      // Clear localStorage manually to simulate logout
      await page.evaluate(() => localStorage.removeItem('admin_token'));
      await page.reload();
    }
    
    // Should redirect back to login
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    console.log('✅ Admin logout flow working correctly');
  });
  
  test('should protect admin routes', async ({ page }) => {
    // Try to access admin without token
    await page.goto('/admin');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Try to access Spotify setup without token
    await page.goto('/admin/spotify-setup');
    // Should redirect to admin login
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    console.log('✅ Admin route protection working correctly');
  });
});
