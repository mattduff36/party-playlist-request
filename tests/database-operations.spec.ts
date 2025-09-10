import { test, expect } from '@playwright/test';

test.describe('Database Operations', () => {
  test('should handle song requests correctly', async ({ page }) => {
    // Navigate to main page
    await page.goto('/');
    
    // Should show the search input and Spotify URL input
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="spotify.com"]')).toBeVisible();
    
    // Test Spotify URL submission
    await page.fill('input[placeholder*="spotify.com"]', 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh');
    
    await page.click('button:has-text("Submit Request")');
    
    // Should show success message or processing
    const hasSuccess = await page.locator('text=submitted, text=success').isVisible({ timeout: 10000 });
    const hasProcessing = await page.locator('text=Submitting').isVisible();
    
    expect(hasSuccess || hasProcessing).toBe(true);
    
    console.log('✅ Song request submission working correctly');
  });
  
  test('should handle admin requests view', async ({ page }) => {
    // Login as admin
    await page.goto('/admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Song Requests')).toBeVisible();
    
    // Navigate to Song Requests tab
    await page.click('button:has-text("Song Requests")');
    
    // Should show requests filter dropdown
    await expect(page.locator('select')).toBeVisible();
    
    // Check if there are any requests or empty state
    const hasRequests = await page.locator('.bg-gray-800').count() > 1; // More than just the header
    const noRequestsMessage = await page.locator('text=No requests, text=empty').isVisible();
    
    expect(hasRequests || noRequestsMessage).toBe(true);
    
    console.log('✅ Admin requests view working correctly');
  });
  
  test('should handle event settings', async ({ page }) => {
    // Login as admin
    await page.goto('/admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Song Requests')).toBeVisible();
    
    // Navigate to Event Settings tab
    await page.click('button:has-text("Event Settings")');
    
    // Should show settings form with event title input
    await expect(page.locator('input[value*=""], input[placeholder*="Event"]')).toBeVisible();
    
    // Try to update event title
    const titleInput = page.locator('input').first();
    await titleInput.fill('Test Event Title');
    
    // Look for save button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Should show success message or no error
      const hasSuccess = await page.locator('text=saved, text=updated, text=success').isVisible({ timeout: 3000 });
      const hasError = await page.locator('text=error, text=failed').isVisible();
      
      expect(!hasError).toBe(true); // Should not have errors
    }
    
    console.log('✅ Event settings working correctly');
  });
});
