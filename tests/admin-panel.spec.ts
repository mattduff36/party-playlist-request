import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin page
    await page.goto('http://localhost:3000/admin');
  });

  test('should load admin login page without errors', async ({ page }) => {
    // Check that login form is visible
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any async errors
    await page.waitForTimeout(2000);
    
    // Should not have any critical console errors
    const criticalErrors = errors.filter(error => 
      !error.includes('Spotify not connected') && 
      !error.includes('Failed to refresh access token')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should login successfully with correct password', async ({ page }) => {
    // Fill in password (using the default from .env.local)
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(3000);
    
    // Should see admin panel content
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Requests')).toBeVisible();
    await expect(page.locator('text=Queue')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('should handle Spotify disconnected state gracefully', async ({ page }) => {
    // Login first
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Check that Spotify connection status is shown
    const spotifyStatus = page.locator('text=Connect to Spotify');
    await expect(spotifyStatus).toBeVisible();
    
    // Navigate to Queue tab
    await page.click('text=Queue');
    await page.waitForTimeout(2000);
    
    // Should show appropriate message for disconnected state
    await expect(page.locator('text=No Spotify device')).toBeVisible();
  });

  test('should not have repeated API errors in console', async ({ page }) => {
    const apiErrors: string[] = [];
    
    // Monitor network requests
    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        apiErrors.push(`${response.status()} ${response.url()}`);
      }
    });
    
    // Login and wait for initial data loading
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000); // Wait for multiple polling cycles
    
    // Filter out expected 401s for Spotify when not connected
    const unexpectedErrors = apiErrors.filter(error => 
      !error.includes('queue/details') || !error.startsWith('401')
    );
    
    // Should not have unexpected API errors
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should navigate between tabs without errors', async ({ page }) => {
    // Login first
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Test navigation between tabs
    await page.click('text=Requests');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Song Requests')).toBeVisible();
    
    await page.click('text=Queue');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Current Track')).toBeVisible();
    
    await page.click('text=Settings');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Event Settings')).toBeVisible();
    
    await page.click('text=Overview');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
  });
});
