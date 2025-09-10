import { test, expect } from '@playwright/test';

test.describe('Admin Panel - Basic Tests', () => {
  test('should load admin page and login without React errors', async ({ page }) => {
    // Monitor console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Spotify')) {
        errors.push(msg.text());
      }
    });

    // Navigate to admin page
    await page.goto('http://localhost:3001/admin');
    
    // Should see login form
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Login
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for login
    await page.waitForTimeout(5000);
    
    // Should see admin dashboard
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    
    // Should not have React rendering errors
    const reactErrors = errors.filter(error => 
      error.includes('Objects are not valid as a React child') ||
      error.includes('Cannot read properties of undefined')
    );
    expect(reactErrors).toHaveLength(0);
  });
});
