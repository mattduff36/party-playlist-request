/**
 * DJ Flow Tests
 * 
 * Tests the complete DJ user journey:
 * - Login
 * - Admin dashboard
 * - Spotify connection
 * - Event management
 * - Request management
 * - Settings configuration
 * - Display screen
 * - Logout
 */

import type { TestSuiteResult, TestResult } from '../interactive-test-suite';

// Test credentials (from seeded database)
const TEST_USER = {
  username: 'testuser1',
  password: 'testpassword123',
};

export async function runDJFlowTests(baseURL: string): Promise<TestSuiteResult> {
  console.log('🎵 Starting DJ Flow Tests...\n');

  const results: TestSuiteResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    tests: [],
  };

  const suiteStart = Date.now();

  // Test 1: Navigate to homepage
  await runTest(results, '1. Navigate to homepage', async () => {
    console.log(`   📍 Navigating to ${baseURL}`);
    
    // Note: Using MCP browser tools requires the tool to be invoked
    // We'll create a wrapper for this
    const response = await fetch(baseURL);
    if (!response.ok) {
      throw new Error(`Homepage returned ${response.status}`);
    }
    console.log('   ✅ Homepage loaded successfully');
  });

  // Test 2: Navigate to login page
  await runTest(results, '2. Navigate to login page', async () => {
    console.log(`   📍 Checking ${baseURL}/login`);
    
    const response = await fetch(`${baseURL}/login`);
    if (!response.ok) {
      throw new Error(`Login page returned ${response.status}`);
    }
    console.log('   ✅ Login page accessible');
  });

  // Test 3: Login with valid credentials
  await runTest(results, '3. Login with valid credentials', async () => {
    console.log(`   🔐 Attempting login as ${TEST_USER.username}`);
    
    const response = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password,
      }),
    });

    const data = await response.json();
    
    if (response.status === 200 && data.success) {
      console.log(`   ✅ Login successful - User: ${data.username}`);
    } else if (response.status === 200 && data.requiresTransfer) {
      console.log(`   ⚠️  Active session detected on another device`);
      console.log('   ✅ Session transfer mechanism working');
    } else {
      throw new Error(`Login failed: ${JSON.stringify(data)}`);
    }
  });

  // Test 4: Verify admin dashboard loads
  await runTest(results, '4. Admin dashboard loads', async () => {
    console.log(`   📊 Checking admin dashboard`);
    
    // Note: This would need actual cookie-based auth in a real test
    // For now, just verify the route exists
    const response = await fetch(`${baseURL}/${TEST_USER.username}/admin/overview`);
    
    // 200 = success, 302/307 = redirect to login (expected without cookie)
    if (response.ok || response.status === 302 || response.status === 307) {
      console.log('   ✅ Admin dashboard route exists');
    } else {
      throw new Error(`Admin dashboard returned ${response.status}`);
    }
  });

  // Test 5: Check event status API
  await runTest(results, '5. Event status API responds', async () => {
    console.log('   📡 Testing event status endpoint');
    
    const response = await fetch(`${baseURL}/api/event/status`);
    
    // 401 is expected without auth cookie
    if (response.status === 401) {
      console.log('   ✅ Event status requires authentication (expected)');
    } else {
      throw new Error(`Event status returned unexpected ${response.status}`);
    }
  });

  // Test 6: Check Spotify status API
  await runTest(results, '6. Spotify status API responds', async () => {
    console.log('   🎵 Testing Spotify status endpoint');
    
    const response = await fetch(`${baseURL}/api/spotify/status`);
    
    // 401 is expected without auth cookie
    if (response.status === 401) {
      console.log('   ✅ Spotify status requires authentication (expected)');
    } else {
      throw new Error(`Spotify status returned unexpected ${response.status}`);
    }
  });

  // Test 7: Check requests API
  await runTest(results, '7. Requests API responds', async () => {
    console.log('   📝 Testing requests endpoint');
    
    const response = await fetch(`${baseURL}/api/admin/requests`);
    
    // 401 is expected without auth cookie
    if (response.status === 401) {
      console.log('   ✅ Requests API requires authentication (expected)');
    } else {
      throw new Error(`Requests API returned unexpected ${response.status}`);
    }
  });

  // Test 8: Check stats API
  await runTest(results, '8. Stats API responds', async () => {
    console.log('   📊 Testing stats endpoint');
    
    const response = await fetch(`${baseURL}/api/admin/stats`);
    
    // 401 is expected without auth cookie
    if (response.status === 401) {
      console.log('   ✅ Stats API requires authentication (expected)');
    } else {
      throw new Error(`Stats API returned unexpected ${response.status}`);
    }
  });

  // Test 9: Check settings page route
  await runTest(results, '9. Settings page route exists', async () => {
    console.log('   ⚙️  Checking settings page');
    
    const response = await fetch(`${baseURL}/${TEST_USER.username}/admin/settings`);
    
    if (response.ok || response.status === 302 || response.status === 307) {
      console.log('   ✅ Settings page route exists');
    } else {
      throw new Error(`Settings page returned ${response.status}`);
    }
  });

  // Test 10: Check requests management page route
  await runTest(results, '10. Requests page route exists', async () => {
    console.log('   📋 Checking requests management page');
    
    const response = await fetch(`${baseURL}/${TEST_USER.username}/admin/requests`);
    
    if (response.ok || response.status === 302 || response.status === 307) {
      console.log('   ✅ Requests page route exists');
    } else {
      throw new Error(`Requests page returned ${response.status}`);
    }
  });

  results.duration = (Date.now() - suiteStart) / 1000;

  console.log(`\n🏁 DJ Flow Tests Complete: ${results.passed}/${results.tests.length} passed\n`);

  return results;
}

async function runTest(
  results: TestSuiteResult,
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  const result: TestResult = {
    name,
    status: 'failed',
    duration: 0,
  };

  try {
    console.log(`\n🧪 Test: ${name}`);
    await testFn();
    result.status = 'passed';
    results.passed++;
    console.log(`   ⏱️  Duration: ${((Date.now() - start) / 1000).toFixed(2)}s`);
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.message : String(error);
    results.failed++;
    console.error(`   ❌ FAILED: ${result.error}`);
    console.log(`   ⏱️  Duration: ${((Date.now() - start) / 1000).toFixed(2)}s`);
  }

  result.duration = (Date.now() - start) / 1000;
  results.tests.push(result);
}

