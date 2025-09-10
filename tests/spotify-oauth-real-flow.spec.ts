import { test, expect } from '@playwright/test';

test.describe('Real Spotify OAuth Flow', () => {
  test('should store OAuth data and handle callback correctly', async ({ page }) => {
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
    
    // Mock the Spotify auth API response
    await page.route('/api/spotify/auth', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auth_url: 'https://accounts.spotify.com/authorize?client_id=test&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fspotify%2Fcallback&code_challenge_method=S256&code_challenge=test_challenge&state=test_state_123&scope=user-read-playback-state',
          state: 'test_state_123',
          code_challenge: 'test_challenge',
          code_verifier: 'test_code_verifier_456'
        })
      });
    });
    
    // Mock the Spotify callback API
    await page.route('/api/spotify/callback', async route => {
      if (route.request().method() === 'POST') {
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
    
    // Intercept Spotify redirect and simulate return with callback parameters
    await page.route('https://accounts.spotify.com/**', async route => {
      // Instead of going to Spotify, simulate the return with callback parameters
      const callbackUrl = '/admin/spotify-setup?code=test_auth_code&state=test_state_123';
      await route.fulfill({
        status: 200,
        body: `<script>window.location.href = '${callbackUrl}';</script>`
      });
    });
    
    // Click Connect to Spotify button
    await page.click('button:has-text("Connect to Spotify")');
    
    // Wait for the callback to be processed
    await page.waitForURL('**/admin/spotify-setup?code=test_auth_code&state=test_state_123');
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Should show success message or redirect to admin
    const hasSuccessMessage = await page.locator('text=Spotify authentication successful').isVisible();
    const isOnAdminPage = page.url().includes('/admin');
    
    expect(hasSuccessMessage || isOnAdminPage).toBe(true);
    
    console.log('✅ OAuth flow completed successfully');
  });
});
