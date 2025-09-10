import { test, expect } from '@playwright/test';

test.describe('Debug localStorage Issue', () => {
  test('should debug localStorage storage step by step', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Navigate to admin login
    await page.goto('/admin');
    
    // Login as admin
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for admin panel to load
    await expect(page.locator('text=Song Requests')).toBeVisible();
    
    // Navigate to Spotify setup
    await page.goto('/admin/spotify-setup');
    
    // Wait for the page to load
    await expect(page.locator('text=Spotify Setup')).toBeVisible();
    
    // Check initial localStorage state
    const initialState = await page.evaluate(() => ({
      state: localStorage.getItem('spotify_state'),
      codeVerifier: localStorage.getItem('spotify_code_verifier')
    }));
    
    console.log('Initial localStorage:', initialState);
    
    // Mock the Spotify auth API response
    await page.route('/api/spotify/auth', async route => {
      console.log('Spotify auth API called');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auth_url: 'https://accounts.spotify.com/authorize?test=true',
          state: 'test_state_123',
          code_challenge: 'test_challenge',
          code_verifier: 'test_code_verifier_456'
        })
      });
    });
    
    // Add debugging to the page
    await page.addInitScript(() => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        console.log('localStorage.setItem called:', key, value);
        return originalSetItem.call(this, key, value);
      };
    });
    
    // Set up a promise to capture localStorage before redirect
    const localStoragePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        // Override window.location.href to capture localStorage before redirect
        const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href');
        Object.defineProperty(window.location, 'href', {
          set: function(url) {
            console.log('About to redirect to:', url);
            // Capture localStorage before redirect
            const state = localStorage.getItem('spotify_state');
            const codeVerifier = localStorage.getItem('spotify_code_verifier');
            resolve({ state, codeVerifier });
            // Don't actually redirect in test
          },
          get: originalHref?.get || (() => window.location.toString())
        });
      });
    });
    
    // Click Connect to Spotify button
    console.log('Clicking Connect to Spotify button...');
    await page.click('button:has-text("Connect to Spotify")');
    
    // Wait for localStorage to be captured
    const finalState = await localStoragePromise;
    
    console.log('Final localStorage:', finalState);
    
    // Check if the values were stored
    expect(finalState.state).toBe('test_state_123');
    expect(finalState.codeVerifier).toBe('test_code_verifier_456');
  });
});
