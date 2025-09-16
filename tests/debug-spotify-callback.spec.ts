import { test, expect } from '@playwright/test';

test.describe('Debug Spotify Callback', () => {
  test('Test Spotify callback with valid admin token', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    // Enable network logging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
        if (request.postData()) {
          console.log(`📤 POST DATA:`, JSON.stringify(JSON.parse(request.postData()), null, 2));
        }
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });

    console.log('\n🎵 Testing Spotify callback with valid admin token...\n');

    // Step 1: Get a valid admin token by logging in
    console.log('🔐 Step 1: Login to get valid admin token');
    await page.goto('http://localhost:3000/admin');
    
    // Login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect and get token
    await page.waitForURL('**/admin/overview');
    const adminToken = await page.evaluate(() => localStorage.getItem('admin_token'));
    
    console.log('✅ Admin token obtained:', {
      exists: !!adminToken,
      length: adminToken?.length,
      starts: adminToken?.substring(0, 30) + '...'
    });

    // Step 2: Test the callback API directly
    console.log('🎵 Step 2: Test Spotify callback API directly');
    
    const callbackResult = await page.evaluate(async (token) => {
      try {
        console.log('🔐 Making callback request with token:', {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenStart: token?.substring(0, 20) + '...'
        });
        
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
        
        console.log('🔍 Callback response status:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
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
    }, adminToken);

    console.log('🔍 Callback API result:', JSON.stringify(callbackResult, null, 2));

    // Step 3: Analyze the result
    console.log('\n🔬 ANALYSIS:');
    if (callbackResult.status === 401) {
      console.log('❌ ISSUE: Authentication failed (401)');
      console.log('🔍 This means the admin token is being rejected by the callback endpoint');
      console.log('🔍 Possible causes:');
      console.log('   - Token validation logic is broken');
      console.log('   - JWT secret mismatch');
      console.log('   - Token format issue');
    } else if (callbackResult.status === 200) {
      console.log('✅ SUCCESS: Authentication worked!');
      console.log('🎯 Callback endpoint accepted the admin token');
      console.log('🎯 Token exchange should have completed');
    } else {
      console.log(`⚠️  UNEXPECTED: Status ${callbackResult.status}`);
      console.log('🔍 Response:', callbackResult.data);
    }

    // Step 4: Test token validation specifically
    console.log('\n🔑 Step 3: Test token validation logic');
    
    const tokenValidationResult = await page.evaluate(async (token) => {
      try {
        // Test with SSE endpoint (uses same auth)
        const response = await fetch('/api/admin/events?token=' + encodeURIComponent(token));
        return {
          status: response.status,
          ok: response.ok,
          endpoint: 'SSE events'
        };
      } catch (error) {
        return {
          error: error.message,
          endpoint: 'SSE events'
        };
      }
    }, adminToken);

    console.log('🔑 Token validation result:', tokenValidationResult);

    if (tokenValidationResult.ok) {
      console.log('✅ Admin token is valid for other endpoints');
      console.log('🎯 Issue is specific to callback endpoint authentication');
    } else {
      console.log('❌ Admin token is invalid for all endpoints');
      console.log('🎯 Issue is with token generation or validation');
    }

    console.log('\n✅ Spotify callback debug test completed');
  });

  test('Test callback authentication step by step', async ({ page }) => {
    console.log('\n🔍 Testing callback authentication step by step...\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));

    // Get admin token
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    const adminToken = await page.evaluate(() => localStorage.getItem('admin_token'));
    console.log('🔑 Got admin token for testing');

    // Test each step of callback authentication
    const authSteps = await page.evaluate(async (token) => {
      const results = {};
      
      // Step 1: Check if token exists
      results.hasToken = !!token;
      results.tokenLength = token?.length;
      
      // Step 2: Check token format (JWT should have 3 parts)
      if (token) {
        const parts = token.split('.');
        results.tokenParts = parts.length;
        results.isJWTFormat = parts.length === 3;
      }
      
      // Step 3: Test auth header construction
      results.authHeader = `Bearer ${token}`;
      results.authHeaderLength = results.authHeader.length;
      
      // Step 4: Test if callback endpoint receives the token
      try {
        const response = await fetch('/api/spotify/callback', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: 'test_code',
            state: 'test_state', 
            code_verifier: 'test_verifier'
          })
        });
        
        results.callbackStatus = response.status;
        results.callbackOk = response.ok;
        
        const responseText = await response.text();
        try {
          results.callbackResponse = JSON.parse(responseText);
        } catch {
          results.callbackResponse = responseText;
        }
        
      } catch (error) {
        results.callbackError = error.message;
      }
      
      return results;
    }, adminToken);

    console.log('🔍 Authentication step analysis:', JSON.stringify(authSteps, null, 2));

    // Determine the exact issue
    if (!authSteps.hasToken) {
      console.log('❌ ISSUE: No admin token found');
    } else if (!authSteps.isJWTFormat) {
      console.log('❌ ISSUE: Token is not in JWT format');
    } else if (authSteps.callbackStatus === 401) {
      console.log('❌ ISSUE: Token is rejected by callback endpoint');
      console.log('🔍 This is the authentication validation problem');
    } else if (authSteps.callbackOk) {
      console.log('✅ SUCCESS: Token authentication works!');
      console.log('🎯 The callback endpoint accepts the token');
    }

    console.log('\n✅ Step-by-step authentication test completed');
  });
});
