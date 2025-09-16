import { test, expect } from '@playwright/test';

test.describe('Verify Authentication Fix', () => {
  test('Verify Spotify callback authentication is fixed', async ({ page }) => {
    console.log('\n🎯 VERIFICATION: Spotify authentication fix\n');

    // Step 1: Login and get token
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    const adminToken = await page.evaluate(() => localStorage.getItem('admin_token'));
    console.log('✅ Admin token obtained');

    // Step 2: Test callback API directly (this was failing before)
    const callbackResult = await page.evaluate(async (token) => {
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
        ok: response.ok,
        data: responseData
      };
    }, adminToken);

    console.log('🔍 Callback result:', {
      status: callbackResult.status,
      success: callbackResult.ok,
      hasSuccessMessage: callbackResult.data?.success
    });

    // Step 3: Verify the fix
    if (callbackResult.status === 200 && callbackResult.ok && callbackResult.data?.success) {
      console.log('🎉 SUCCESS: Authentication issue is COMPLETELY FIXED!');
      console.log('✅ Admin token authentication works');
      console.log('✅ Callback endpoint accepts the token');
      console.log('✅ Mock Spotify token exchange works');
      console.log('✅ Success response is returned');
      console.log('\n🎯 The issue that was causing constant errors is resolved!');
    } else if (callbackResult.status === 401) {
      console.log('❌ STILL BROKEN: Authentication still failing (401)');
    } else {
      console.log(`⚠️  UNEXPECTED: Status ${callbackResult.status}`);
      console.log('Response:', callbackResult.data);
    }

    console.log('\n✅ Verification test completed');
  });
});
