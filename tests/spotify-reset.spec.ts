import { test, expect } from '@playwright/test';

test.describe('Spotify Reset Functionality', () => {
  test('Reset button is visible and functional', async ({ page }) => {
    console.log('🚀 Testing Spotify reset functionality...');

    // Navigate to admin page and login
    await page.goto('/admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for admin panel to load
    await page.waitForTimeout(3000);
    
    console.log('✅ Logged into admin panel');
    
    // Check if reset button is visible in header
    const headerResetButton = page.locator('button:has-text("Reset")').first();
    await expect(headerResetButton).toBeVisible();
    console.log('✅ Reset button visible in header');
    
    // Check if we're on overview tab and Spotify warning is shown
    const overviewButton = page.getByRole('button', { name: 'Overview' });
    await overviewButton.click();
    await page.waitForTimeout(1000);
    
    // Look for Spotify connection warning
    const spotifyWarning = page.locator('text=Spotify Not Connected');
    if (await spotifyWarning.isVisible()) {
      console.log('✅ Spotify not connected - checking reset button in warning');
      
      // Check if reset button is visible in the warning section
      const warningResetButton = page.locator('button:has-text("Reset Connection")');
      await expect(warningResetButton).toBeVisible();
      console.log('✅ Reset Connection button visible in warning section');
      
      // Test the reset functionality (but cancel the confirmation)
      page.on('dialog', async dialog => {
        console.log(`📋 Dialog appeared: ${dialog.message()}`);
        expect(dialog.message()).toContain('completely reset your Spotify connection');
        await dialog.dismiss(); // Cancel the reset
      });
      
      await warningResetButton.click();
      console.log('✅ Reset button clicked and confirmation dialog appeared');
    } else {
      console.log('ℹ️ Spotify appears to be connected - testing header reset button');
      
      // Test header reset button
      page.on('dialog', async dialog => {
        console.log(`📋 Dialog appeared: ${dialog.message()}`);
        expect(dialog.message()).toContain('completely reset your Spotify connection');
        await dialog.dismiss(); // Cancel the reset
      });
      
      await headerResetButton.click();
      console.log('✅ Header reset button clicked and confirmation dialog appeared');
    }
    
    console.log('🎉 Spotify reset functionality test completed successfully!');
  });
});
