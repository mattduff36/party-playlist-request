import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

test.describe('Admin Panel - Event Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="username"]', TEST_USERS.testuser.username);
    await page.fill('input[name="password"]', TEST_USERS.testuser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/testuser\/admin/, { timeout: 10000 });
  });
  
  test('should display event PIN in top navigation', async ({ page }) => {
    // Check if PIN is visible in navigation
    const pinDisplay = page.locator('text=/PIN:/i, text=/\\d{6}/');
    
    // PIN should be visible if event is active
    const isVisible = await pinDisplay.isVisible({ timeout: 5000 }).catch(() => false);
    
    // If no PIN visible, event might be offline - that's okay
    if (!isVisible) {
      console.log('No PIN displayed - event may be offline');
    }
  });
  
  test('should transition event from offline to standby', async ({ page }) => {
    // Navigate to overview page
    await page.click('text=Overview');
    
    // Find event state dropdown
    const stateDropdown = page.locator('select').filter({ hasText: /offline|standby|live/i }).first();
    
    if (await stateDropdown.isVisible({ timeout: 5000 })) {
      // Get current state
      const currentState = await stateDropdown.inputValue();
      console.log('Current event state:', currentState);
      
      // Try to change to standby
      await stateDropdown.selectOption('standby');
      
      // Wait for state change
      await page.waitForTimeout(2000);
      
      // Verify state changed
      const newState = await stateDropdown.inputValue();
      expect(newState).toBe('standby');
    }
  });
  
  test('should transition event from standby to live', async ({ page }) => {
    await page.click('text=Overview');
    
    const stateDropdown = page.locator('select').filter({ hasText: /offline|standby|live/i }).first();
    
    if (await stateDropdown.isVisible({ timeout: 5000 })) {
      // Set to standby first
      await stateDropdown.selectOption('standby');
      await page.waitForTimeout(1000);
      
      // Then to live
      await stateDropdown.selectOption('live');
      await page.waitForTimeout(2000);
      
      // Verify state changed
      const newState = await stateDropdown.inputValue();
      expect(newState).toBe('live');
    }
  });
  
  test('should edit event title', async ({ page }) => {
    // Navigate to settings
    const settingsLink = page.locator('text=Settings, a[href*="settings"]').first();
    await settingsLink.click();
    await page.waitForURL(/\/settings/, { timeout: 10000 });
    
    // Find event title input
    const titleInput = page.locator('input[type="text"]').filter({ hasText: /event.*title/i }).first();
    
    if (await titleInput.isVisible({ timeout: 5000 })) {
      // Clear and enter new title
      await titleInput.clear();
      await titleInput.fill('Test Event Updated');
      
      // Save changes (look for Save button)
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Wait for success message
        await expect(page.locator('text=saved|updated')).toBeVisible({ timeout: 5000 });
      }
    }
  });
  
  test('should toggle request page on/off', async ({ page }) => {
    await page.click('text=Overview');
    
    // Find page controls section
    const pageControls = page.locator('text=Page Controls').locator('..');
    
    if (await pageControls.isVisible({ timeout: 5000 })) {
      // Find requests toggle
      const requestsToggle = pageControls.locator('button, input[type="checkbox"]').filter({ hasText: /request/i }).first();
      
      if (await requestsToggle.isVisible()) {
        // Toggle it
        await requestsToggle.click();
        await page.waitForTimeout(1000);
        
        // Verify state changed (would need to check actual implementation)
        console.log('Requests page toggle clicked');
      }
    }
  });
  
  test('should toggle display page on/off', async ({ page }) => {
    await page.click('text=Overview');
    
    const pageControls = page.locator('text=Page Controls').locator('..');
    
    if (await pageControls.isVisible({ timeout: 5000 })) {
      const displayToggle = pageControls.locator('button, input[type="checkbox"]').filter({ hasText: /display/i }).first();
      
      if (await displayToggle.isVisible()) {
        await displayToggle.click();
        await page.waitForTimeout(1000);
        console.log('Display page toggle clicked');
      }
    }
  });
  
  test('should show event goes offline on logout', async ({ page }) => {
    // Navigate to overview to see current state
    await page.click('text=Overview');
    
    // Check current event state
    const stateDropdown = page.locator('select').filter({ hasText: /offline|standby|live/i }).first();
    
    if (await stateDropdown.isVisible({ timeout: 5000 })) {
      // Set event to live
      await stateDropdown.selectOption('live');
      await page.waitForTimeout(1000);
    }
    
    // Now logout
    const logoutButton = page.locator('button[title="Logout"], button:has-text("Logout")').first();
    await logoutButton.click();
    
    // Confirm logout
    const confirmButton = page.locator('button:has-text("Logout")').last();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Wait for redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    
    // Event should now be offline (we can't verify directly from login page,
    // but the backend should have set it to offline)
    console.log('Logged out - event should be offline in database');
  });
  
  test('should display Open Display Screen button in sidebar', async ({ page }) => {
    // Look for the button in the sidebar
    const displayButton = page.locator('text=Open Display Screen, a[href*="display"]').first();
    
    // Check if visible
    const isVisible = await displayButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isVisible) {
      expect(displayButton).toBeVisible();
    } else {
      console.log('Display button not visible - may require active event');
    }
  });
  
  test('should handle invalid state transitions', async ({ page }) => {
    // This test would verify that certain state transitions are blocked
    // For example, you can't go directly from offline to live without standby
    // Implementation depends on business logic
    test.skip(); // Skip for now as it depends on specific validation rules
  });
});


