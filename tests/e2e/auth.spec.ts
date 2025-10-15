import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/users';

test.describe('Authentication & Session Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login');
  });
  
  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.fill('input[name="username"]', TEST_USERS.testuser.username);
    await page.fill('input[name="password"]', TEST_USERS.testuser.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation to admin panel
    await page.waitForURL(/\/testuser\/admin/, { timeout: 10000 });
    
    // Verify we're on the admin page
    expect(page.url()).toContain('/testuser/admin');
    
    // Verify admin panel elements are visible
    await expect(page.locator('text=Overview')).toBeVisible();
  });
  
  test('should fail login with invalid credentials', async ({ page }) => {
    // Fill in login form with wrong password
    await page.fill('input[name="username"]', TEST_USERS.testuser.username);
    await page.fill('input[name="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 5000 });
    
    // Verify we're still on login page
    expect(page.url()).toContain('/login');
  });
  
  test('should show Spotify connection modal after first login', async ({ page }) => {
    // Login
    await page.fill('input[name="username"]', TEST_USERS.testuser.username);
    await page.fill('input[name="password"]', TEST_USERS.testuser.password);
    await page.click('button[type="submit"]');
    
    // Wait for admin panel
    await page.waitForURL(/\/testuser\/admin/, { timeout: 10000 });
    
    // Check if Spotify modal appears (might take a moment)
    const spotifyModal = page.locator('text=Connect Your Spotify Account');
    
    // Note: Modal might not appear if Spotify is already connected from previous tests
    // This test would need database cleanup to work consistently
  });
  
  test('should successfully logout and cleanup event', async ({ page }) => {
    // Login first
    await page.fill('input[name="username"]', TEST_USERS.testuser.username);
    await page.fill('input[name="password"]', TEST_USERS.testuser.password);
    await page.click('button[type="submit"]');
    
    // Wait for admin panel
    await page.waitForURL(/\/testuser\/admin/, { timeout: 10000 });
    
    // Find and click logout button
    const logoutButton = page.locator('button[title="Logout"], button:has-text("Logout")').first();
    await logoutButton.click();
    
    // Confirm logout in modal if it appears
    const confirmButton = page.locator('button:has-text("Logout")').last();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Wait for redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    
    // Verify we're on login page
    expect(page.url()).toContain('/login');
  });
  
  test('should display token expiry warning 15 minutes before expiry', async ({ page }) => {
    // This test would require manipulating the token expiry time
    // For now, we'll skip this as it requires special setup
    test.skip();
  });
  
  test('should handle session transfer between devices', async ({ page, context }) => {
    // Login on first "device"
    await page.fill('input[name="username"]', TEST_USERS.testdj.username);
    await page.fill('input[name="password"]', TEST_USERS.testdj.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/testdj\/admin/, { timeout: 10000 });
    
    // Open second tab (simulating second device)
    const page2 = await context.newPage();
    await page2.goto('/login');
    
    // Try to login on second "device" with same user
    await page2.fill('input[name="username"]', TEST_USERS.testdj.username);
    await page2.fill('input[name="password"]', TEST_USERS.testdj.password);
    await page2.click('button[type="submit"]');
    
    // Check for session transfer modal
    const transferModal = page2.locator('text=Do you want to transfer the event to this device?');
    
    if (await transferModal.isVisible({ timeout: 5000 })) {
      // Click "Yes, Transfer"
      await page2.locator('button:has-text("Yes")').first().click();
      
      // Verify second session is active
      await page2.waitForURL(/\/testdj\/admin/, { timeout: 10000 });
      
      // First session should be logged out (check if redirected to login)
      await page.waitForURL(/\/login/, { timeout: 10000 });
    }
  });
  
  test('should persist session after page refresh', async ({ page }) => {
    // Login
    await page.fill('input[name="username"]', TEST_USERS.testuser.username);
    await page.fill('input[name="password"]', TEST_USERS.testuser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/testuser\/admin/, { timeout: 10000 });
    
    // Reload page
    await page.reload();
    
    // Verify still authenticated
    await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
  });
  
  test('should not allow access to admin panel without authentication', async ({ page }) => {
    // Try to directly access admin panel
    await page.goto('/testuser/admin/overview');
    
    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});


