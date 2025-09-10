import { test, expect } from '@playwright/test';

test.describe('Spotify OAuth Flow', () => {
  test('should store OAuth data in localStorage before redirecting to Spotify', async ({ page }) => {
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
    
    // Check initial state - should not be connected
    await expect(page.locator('text=Not connected to Spotify')).toBeVisible();
    
    // Mock the Spotify auth API response
    await page.route('/api/spotify/auth', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auth_url: 'https://accounts.spotify.com/authorize?client_id=test&response_type=code&redirect_uri=https%3A%2F%2Fpartyplaylist.co.uk%2Fapi%2Fspotify%2Fcallback&code_challenge_method=S256&code_challenge=test_challenge&state=test_state_123&scope=user-read-playback-state%20user-modify-playback-state%20user-read-currently-playing%20playlist-modify-private%20playlist-modify-public',
          state: 'test_state_123',
          code_challenge: 'test_challenge',
          code_verifier: 'test_code_verifier_456'
        })
      });
    });
    
    // Intercept the redirect to Spotify to prevent actual navigation
    await page.route('https://accounts.spotify.com/**', async route => {
      // Prevent the redirect and just return a success response
      await route.fulfill({
        status: 200,
        body: 'Redirected to Spotify (intercepted for testing)'
      });
    });
    
    // Click Connect to Spotify button
    await page.click('button:has-text("Connect to Spotify")');
    
    // Wait a moment for the localStorage to be set and API call to complete
    await page.waitForTimeout(2000);
    
    // Check that OAuth data was stored in localStorage
    const storedState = await page.evaluate(() => localStorage.getItem('spotify_state'));
    const storedCodeVerifier = await page.evaluate(() => localStorage.getItem('spotify_code_verifier'));
    
    expect(storedState).toBe('test_state_123');
    expect(storedCodeVerifier).toBe('test_code_verifier_456');
    
    console.log('✅ OAuth data correctly stored in localStorage');
  });
  
  test('should handle OAuth callback with stored data', async ({ page }) => {
    // Set up localStorage with OAuth data (simulating return from Spotify)
    await page.goto('/admin');
    
    // Login first
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Song Requests')).toBeVisible();
    
    // Set OAuth data in localStorage
    await page.evaluate(() => {
      localStorage.setItem('spotify_state', 'test_state_123');
      localStorage.setItem('spotify_code_verifier', 'test_code_verifier_456');
    });
    
    // Mock the callback API
    await page.route('/api/spotify/callback', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Spotify authentication successful',
            expires_in: 3600,
            scope: 'user-read-playback-state user-modify-playback-state'
          })
        });
      }
    });
    
    // Mock the stats API to show connected
    await page.route('/api/admin/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_requests: 0,
          pending_requests: 0,
          approved_requests: 0,
          rejected_requests: 0,
          today_requests: 0,
          recent_requests: 0,
          top_artists: [],
          spotify_connected: true
        })
      });
    });
    
    // Navigate to Spotify setup with callback parameters
    await page.goto('/admin/spotify-setup?code=test_auth_code&state=test_state_123');
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Should show success message
    await expect(page.locator('text=Spotify authentication successful')).toBeVisible();
    
    console.log('✅ OAuth callback handled successfully with stored data');
  });
});
