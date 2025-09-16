import { test, expect } from '@playwright/test';

test.describe('Debug Authentication Flow', () => {
  test('Complete admin login and Spotify callback flow', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    // Enable network logging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
        if (request.postData()) {
          console.log(`📤 POST DATA:`, request.postData());
        }
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });

    console.log('\n🚀 Starting authentication flow test...\n');

    // Step 1: Navigate to admin login
    console.log('📍 Step 1: Navigate to admin login');
    await page.goto('http://localhost:3000/admin');
    await page.waitForLoadState('networkidle');

    // Step 2: Check if already logged in
    const isLoggedIn = await page.locator('text=Admin Panel').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isLoggedIn) {
      console.log('🔐 Step 2: Performing admin login');
      
      // Fill login form
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      
      // Wait for login to complete
      await page.waitForSelector('text=Admin Panel', { timeout: 10000 });
      console.log('✅ Admin login successful');
    } else {
      console.log('✅ Already logged in');
    }

    // Step 3: Check localStorage for admin token
    const adminToken = await page.evaluate(() => localStorage.getItem('admin_token'));
    console.log('🔑 Admin token in localStorage:', {
      exists: !!adminToken,
      length: adminToken?.length,
      starts: adminToken?.substring(0, 20) + '...'
    });

    // Step 4: Navigate to Spotify setup
    console.log('📍 Step 3: Navigate to Spotify setup');
    await page.goto('http://localhost:3000/admin/spotify-setup');
    await page.waitForLoadState('networkidle');

    // Step 5: Simulate Spotify callback with test parameters
    console.log('🎵 Step 4: Simulate Spotify callback');
    
    // Set up mock OAuth session data in localStorage
    const mockState = 'test_state_' + Date.now();
    const mockCodeVerifier = 'test_code_verifier_' + Date.now();
    
    await page.evaluate(({ state, verifier }) => {
      localStorage.setItem('spotify_state', state);
      localStorage.setItem('spotify_code_verifier', verifier);
    }, { state: mockState, verifier: mockCodeVerifier });

    // Navigate with callback parameters
    const callbackUrl = `http://localhost:3000/admin/spotify-setup?code=test_auth_code&state=${mockState}`;
    console.log('🔗 Navigating to callback URL:', callbackUrl);
    
    await page.goto(callbackUrl);
    await page.waitForLoadState('networkidle');

    // Step 6: Wait for callback processing and capture all logs
    console.log('⏳ Step 5: Waiting for callback processing...');
    await page.waitForTimeout(3000); // Give time for async operations

    // Step 7: Check final state
    console.log('🔍 Step 6: Checking final authentication state');
    
    // Check for success/error messages
    const successMessage = await page.locator('text*=successful').isVisible().catch(() => false);
    const errorMessage = await page.locator('text*=failed').isVisible().catch(() => false);
    
    console.log('📊 Final state:', {
      successVisible: successMessage,
      errorVisible: errorMessage,
      currentUrl: page.url()
    });

    // Step 8: Check network requests made during callback
    console.log('\n📡 Checking callback API request...');
    
    // Make a direct API call to test authentication
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      console.log('Making test API call with token:', {
        hasToken: !!token,
        tokenLength: token?.length
      });
      
      try {
        const response = await fetch('/api/spotify/callback', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: 'test_auth_code',
            state: 'test_state',
            code_verifier: 'test_code_verifier'
          })
        });
        
        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }
        
        return {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          data: responseData,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (error) {
        return {
          error: error.message,
          stack: error.stack
        };
      }
    });

    console.log('🔍 Direct API call result:', JSON.stringify(response, null, 2));

    // Step 9: Analyze the issue
    console.log('\n🔬 ANALYSIS:');
    if (response.status === 401) {
      console.log('❌ ISSUE: Authentication failed (401)');
      console.log('🔍 Possible causes:');
      console.log('   - Admin token is invalid/expired');
      console.log('   - JWT secret mismatch');
      console.log('   - Token not being sent correctly');
    } else if (response.status === 200) {
      console.log('✅ SUCCESS: Authentication worked');
      console.log('🎯 Token exchange should have completed');
    } else {
      console.log(`⚠️  UNEXPECTED: Status ${response.status}`);
    }

    // Don't fail the test - we're debugging
    console.log('\n✅ Debug test completed - check logs above for issues');
  });

  test('Test admin token validation directly', async ({ page }) => {
    console.log('\n🔍 Testing admin token validation...\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));

    await page.goto('http://localhost:3000/admin');
    
    // Login if needed
    const isLoggedIn = await page.locator('text=Admin Panel').isVisible({ timeout: 2000 }).catch(() => false);
    if (!isLoggedIn) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Admin Panel');
    }

    // Test token validation
    const tokenTest = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      // Test with a simple authenticated endpoint
      try {
        const response = await fetch('/api/admin/events?token=' + encodeURIComponent(token));
        return {
          status: response.status,
          ok: response.ok,
          hasToken: !!token,
          tokenValid: response.status !== 401
        };
      } catch (error) {
        return {
          error: error.message,
          hasToken: !!token
        };
      }
    });

    console.log('🔑 Token validation result:', tokenTest);
    
    if (!tokenTest.tokenValid) {
      console.log('❌ Admin token is invalid - this is the root cause!');
    } else {
      console.log('✅ Admin token is valid - issue is elsewhere');
    }
  });
});
