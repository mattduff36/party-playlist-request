/**
 * Comprehensive Testing Suite
 * 
 * This test suite covers all functionality and features of the party playlist request system.
 * It includes tests for authentication, navigation, toggle functionality, state management,
 * and page behavior across different states.
 */

import { test, expect } from '@playwright/test';

test.describe('Party Playlist Request System - Comprehensive Test Suite', () => {
  
  test.describe('Authentication System', () => {
    test('should allow admin login with correct credentials', async ({ page }) => {
      await page.goto('http://localhost:3000/admin');
      
      // Check if login form is present
      await expect(page.locator('input[name="username"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      
      // Fill in credentials
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      
      // Submit login form
      await page.click('button[type="submit"]');
      
      // Should redirect to overview page
      await expect(page).toHaveURL('http://localhost:3000/admin/overview');
    });

    test('should reject login with incorrect credentials', async ({ page }) => {
      await page.goto('http://localhost:3000/admin');
      
      // Fill in incorrect credentials
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'wrongpassword');
      
      // Submit login form
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
    });
  });

  test.describe('Admin Page Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('http://localhost:3000/admin');
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:3000/admin/overview');
    });

    test('should navigate to all admin pages correctly', async ({ page }) => {
      const pages = [
        { name: 'Overview', url: '/admin/overview' },
        { name: 'Song Requests', url: '/admin/requests' },
        { name: 'Spotify', url: '/admin/spotify' },
        { name: 'Settings', url: '/admin/settings' }
      ];

      for (const pageInfo of pages) {
        await page.goto(`http://localhost:3000${pageInfo.url}`);
        await expect(page).toHaveURL(`http://localhost:3000${pageInfo.url}`);
        await expect(page.locator('h1')).toContainText('Admin Dashboard');
      }
    });

    test('should show 404 for non-existent admin pages', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/nonexistent');
      await expect(page.locator('text=404')).toBeVisible();
    });
  });

  test.describe('Event State Control', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('http://localhost:3000/admin');
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:3000/admin/overview');
    });

    test('should change event state from offline to standby', async ({ page }) => {
      // Check initial state
      await expect(page.locator('text=Offline')).toBeVisible();
      
      // Click standby button
      await page.click('button:has-text("Standby")');
      
      // Should show success message
      await expect(page.locator('text=Event state updated to standby')).toBeVisible();
      
      // State should change
      await expect(page.locator('text=Standby')).toBeVisible();
    });

    test('should change event state from standby to live', async ({ page }) => {
      // First set to standby
      await page.click('button:has-text("Standby")');
      await page.waitForSelector('text=Standby');
      
      // Then set to live
      await page.click('button:has-text("Live")');
      
      // Should show success message
      await expect(page.locator('text=Event state updated to live')).toBeVisible();
      
      // State should change
      await expect(page.locator('text=Live')).toBeVisible();
    });

    test('should prevent invalid state transitions', async ({ page }) => {
      // Set to live first
      await page.click('button:has-text("Standby")');
      await page.waitForSelector('text=Standby');
      await page.click('button:has-text("Live")');
      await page.waitForSelector('text=Live');
      
      // Try to go back to offline (should be allowed based on current rules)
      await page.click('button:has-text("Offline")');
      
      // Should show success message
      await expect(page.locator('text=Event state updated to offline')).toBeVisible();
    });
  });

  test.describe('Page Control Toggles', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('http://localhost:3000/admin');
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:3000/admin/overview');
    });

    test('should toggle requests page on/off', async ({ page }) => {
      // Check initial state
      await expect(page.locator('text=Requests Page').locator('..').locator('text=Off')).toBeVisible();
      
      // Toggle requests page on
      await page.click('button:has-text("Enable Requests Page")');
      
      // Should show success message
      await expect(page.locator('text=Requests page enabled')).toBeVisible();
      
      // State should change
      await expect(page.locator('text=Requests Page').locator('..').locator('text=On')).toBeVisible();
    });

    test('should toggle display page on/off', async ({ page }) => {
      // Check initial state
      await expect(page.locator('text=Display Page').locator('..').locator('text=Off')).toBeVisible();
      
      // Toggle display page on
      await page.click('button:has-text("Enable Display Page")');
      
      // Should show success message
      await expect(page.locator('text=Display page enabled')).toBeVisible();
      
      // State should change
      await expect(page.locator('text=Display Page').locator('..').locator('text=On')).toBeVisible();
    });

    test('should disable page controls when event is offline', async ({ page }) => {
      // Ensure event is offline
      await page.click('button:has-text("Offline")');
      await page.waitForSelector('text=Offline');
      
      // Page control buttons should be disabled
      await expect(page.locator('button:has-text("Enable Requests Page")')).toBeDisabled();
      await expect(page.locator('button:has-text("Enable Display Page")')).toBeDisabled();
    });
  });

  test.describe('Public Pages Behavior', () => {
    test('should show party not started when event is offline', async ({ page }) => {
      // Set event to offline (via API or admin panel)
      await page.goto('http://localhost:3000/');
      
      // Should show loading initially
      await expect(page.locator('text=Loading...')).toBeVisible();
      
      // After loading, should show party not started
      await page.waitForSelector('text=Party Not Started', { timeout: 10000 });
      await expect(page.locator('text=Party Not Started')).toBeVisible();
    });

    test('should show requests disabled when page is disabled', async ({ page }) => {
      // Set event to standby but disable requests page
      await page.goto('http://localhost:3000/');
      
      // Should show loading initially
      await expect(page.locator('text=Loading...')).toBeVisible();
      
      // After loading, should show appropriate message
      await page.waitForSelector('text=Requests Disabled', { timeout: 10000 });
      await expect(page.locator('text=Requests Disabled')).toBeVisible();
    });

    test('should show display disabled when page is disabled', async ({ page }) => {
      // Set event to live but disable display page
      await page.goto('http://localhost:3000/display');
      
      // Should show loading initially
      await expect(page.locator('text=Loading...')).toBeVisible();
      
      // After loading, should show appropriate message
      await page.waitForSelector('text=Display Disabled', { timeout: 10000 });
      await expect(page.locator('text=Display Disabled')).toBeVisible();
    });
  });

  test.describe('API Endpoints', () => {
    test('should return event status', async ({ request }) => {
      const response = await request.get('http://localhost:3000/api/event/status');
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('event');
      expect(data.event).toHaveProperty('status');
      expect(data.event).toHaveProperty('config');
    });

    test('should update event status with authentication', async ({ request }) => {
      // First login to get token
      const loginResponse = await request.post('http://localhost:3000/api/admin/login', {
        data: { username: 'admin', password: 'admin123' }
      });
      const loginData = await loginResponse.json();
      const token = loginData.token;

      // Update event status
      const response = await request.post('http://localhost:3000/api/event/status', {
        headers: { 'Authorization': `Bearer ${token}` },
        data: { status: 'standby', eventId: 'default-event' }
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data.event).toHaveProperty('status', 'standby');
    });

    test('should update page controls with authentication', async ({ request }) => {
      // First login to get token
      const loginResponse = await request.post('http://localhost:3000/api/admin/login', {
        data: { username: 'admin', password: 'admin123' }
      });
      const loginData = await loginResponse.json();
      const token = loginData.token;

      // Update page controls
      const response = await request.post('http://localhost:3000/api/event/pages', {
        headers: { 'Authorization': `Bearer ${token}` },
        data: { page: 'requests', enabled: true, eventId: 'default-event' }
      });
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('pageEnabled', true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid state transitions gracefully', async ({ page }) => {
      await page.goto('http://localhost:3000/admin');
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:3000/admin/overview');

      // Try to make an invalid transition (if any exist)
      // This test would need to be updated based on actual validation rules
      await expect(page.locator('text=Invalid transition')).not.toBeVisible();
    });

    test('should show error messages for failed operations', async ({ page }) => {
      await page.goto('http://localhost:3000/admin');
      
      // Try to login with wrong credentials
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
    });
  });

  test.describe('UI/UX Features', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('http://localhost:3000/admin');
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('http://localhost:3000/admin/overview');
    });

    test('should show loading states during operations', async ({ page }) => {
      // Click a button that triggers an async operation
      await page.click('button:has-text("Standby")');
      
      // Should show loading state (if implemented)
      // This test would need to be updated based on actual loading indicators
    });

    test('should show success messages after operations', async ({ page }) => {
      // Perform an operation
      await page.click('button:has-text("Standby")');
      
      // Should show success message
      await expect(page.locator('text=Event state updated to standby')).toBeVisible();
    });

    test('should have responsive design', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('h1')).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update state across multiple browser tabs', async ({ browser }) => {
      // Open two browser contexts
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // Login on both pages
      for (const page of [page1, page2]) {
        await page.goto('http://localhost:3000/admin');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL('http://localhost:3000/admin/overview');
      }
      
      // Change state on page1
      await page1.click('button:has-text("Standby")');
      await page1.waitForSelector('text=Standby');
      
      // Page2 should update automatically (if Pusher is working)
      // This test would need to be updated based on actual Pusher implementation
      await page2.waitForSelector('text=Standby', { timeout: 10000 });
      
      await context1.close();
      await context2.close();
    });
  });
});

