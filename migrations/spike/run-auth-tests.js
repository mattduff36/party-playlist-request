#!/usr/bin/env node

/**
 * Spike 2 Test Runner
 * Validates JWT authentication and route protection
 * 
 * Usage: node migrations/spike/run-auth-tests.js
 */

const API_BASE = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';

console.log('🚀 Spike 2: Authentication & Route Protection Tests\n');
console.log(`📊 API Base: ${API_BASE}\n`);

let testsPassed = 0;
let testsFailed = 0;

// Test helper
async function runTest(name, testFn) {
  console.log(`\n📝 Running: ${name}`);
  try {
    await testFn();
    console.log(`   ✅ PASS`);
    testsPassed++;
    return true;
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    testsFailed++;
    return false;
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

async function test1_LoginSuccess() {
  const response = await fetch(`${API_BASE}/api/spike-test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'johnsmith', password: 'password123' })
  });
  
  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success || !data.token) {
    throw new Error('Login response missing token');
  }
  
  if (data.user.username !== 'johnsmith') {
    throw new Error('Wrong user returned');
  }
  
  // Save token for subsequent tests
  global.johnToken = data.token;
  console.log(`   Token generated (${data.token.substring(0, 20)}...)`);
  console.log(`   Performance: ${data.performance_ms.toFixed(2)}ms`);
}

async function test2_LoginInvalidPassword() {
  const response = await fetch(`${API_BASE}/api/spike-test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'johnsmith', password: 'wrongpassword' })
  });
  
  if (response.ok) {
    throw new Error('Login should have failed with wrong password');
  }
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
}

async function test3_ProtectedEndpointWithToken() {
  const response = await fetch(`${API_BASE}/api/spike-test/protected`, {
    headers: { 'Authorization': `Bearer ${global.johnToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`Protected endpoint failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success || data.user.username !== 'johnsmith') {
    throw new Error('Protected endpoint returned wrong data');
  }
}

async function test4_ProtectedEndpointWithoutToken() {
  const response = await fetch(`${API_BASE}/api/spike-test/protected`);
  
  if (response.ok) {
    throw new Error('Protected endpoint should have rejected request');
  }
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.code !== 'NO_TOKEN') {
    throw new Error('Wrong error code returned');
  }
}

async function test5_UserAccessOwnResource() {
  const response = await fetch(`${API_BASE}/api/spike-test/user/johnsmith`, {
    headers: { 'Authorization': `Bearer ${global.johnToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`User endpoint failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success || !data.match) {
    throw new Error('User should be able to access their own resource');
  }
}

async function test6_UserAccessOtherResource() {
  const response = await fetch(`${API_BASE}/api/spike-test/user/janedoe`, {
    headers: { 'Authorization': `Bearer ${global.johnToken}` }
  });
  
  if (response.ok) {
    throw new Error('User should NOT be able to access another user\\'s resource');
  }
  
  if (response.status !== 403) {
    throw new Error(`Expected 403, got ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.code !== 'NOT_OWNER') {
    throw new Error('Wrong error code returned');
  }
  
  console.log(`   Correctly blocked: ${data.your_username} tried to access ${data.requested_username}`);
}

async function test7_SuperAdminOverride() {
  // First, login as super admin
  const loginResponse = await fetch(`${API_BASE}/api/spike-test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
  });
  
  if (!loginResponse.ok) {
    throw new Error('Super admin login failed');
  }
  
  const loginData = await loginResponse.json();
  const superAdminToken = loginData.token;
  
  // Super admin should be able to access any user's resource
  const response = await fetch(`${API_BASE}/api/spike-test/user/johnsmith`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  
  if (!response.ok) {
    throw new Error('Super admin should be able to access any resource');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error('Super admin access failed');
  }
  
  console.log(`   Super admin successfully accessed another user's resource`);
}

async function test8_SuperAdminEndpoint() {
  // Login as regular user
  const johnResponse = await fetch(`${API_BASE}/api/spike-test/superadmin`, {
    headers: { 'Authorization': `Bearer ${global.johnToken}` }
  });
  
  if (johnResponse.ok) {
    throw new Error('Regular user should NOT access super admin endpoint');
  }
  
  if (johnResponse.status !== 403) {
    throw new Error(`Expected 403, got ${johnResponse.status}`);
  }
  
  const johnData = await johnResponse.json();
  
  if (johnData.code !== 'NOT_SUPERADMIN') {
    throw new Error('Wrong error code returned');
  }
  
  // Login as super admin
  const loginResponse = await fetch(`${API_BASE}/api/spike-test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'admin123' })
  });
  
  const loginData = await loginResponse.json();
  const superAdminToken = loginData.token;
  
  // Super admin should access super admin endpoint
  const adminResponse = await fetch(`${API_BASE}/api/spike-test/superadmin`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` }
  });
  
  if (!adminResponse.ok) {
    throw new Error('Super admin should access super admin endpoint');
  }
  
  console.log(`   Regular user blocked ✅, Super admin allowed ✅`);
}

async function test9_InvalidUsername() {
  // Try path traversal
  const response = await fetch(`${API_BASE}/api/spike-test/user/../../../etc/passwd`, {
    headers: { 'Authorization': `Bearer ${global.johnToken}` }
  });
  
  if (response.status !== 400 && response.status !== 404) {
    throw new Error(`Path traversal should be blocked, got ${response.status}`);
  }
  
  console.log(`   Path traversal attack blocked`);
}

async function test10_TokenExpiry() {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-spike';
  
  // Create an expired token
  const expiredToken = jwt.sign(
    { user_id: '123', username: 'test', email: 'test@test.com', role: 'user' },
    JWT_SECRET,
    { expiresIn: '0s' } // Already expired
  );
  
  // Wait a moment to ensure expiry
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const response = await fetch(`${API_BASE}/api/spike-test/protected`, {
    headers: { 'Authorization': `Bearer ${expiredToken}` }
  });
  
  if (response.ok) {
    throw new Error('Expired token should be rejected');
  }
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
  
  console.log(`   Expired token correctly rejected`);
}

async function test11_Performance1000Requests() {
  console.log(`   Running 1000 authentication checks...`);
  const start = Date.now();
  
  const promises = [];
  for (let i = 0; i < 1000; i++) {
    promises.push(
      fetch(`${API_BASE}/api/spike-test/protected`, {
        headers: { 'Authorization': `Bearer ${global.johnToken}` }
      })
    );
  }
  
  await Promise.all(promises);
  
  const duration = Date.now() - start;
  const avgPerRequest = duration / 1000;
  
  console.log(`   Total time: ${duration}ms`);
  console.log(`   Average per request: ${avgPerRequest.toFixed(2)}ms`);
  
  if (avgPerRequest > 50) {
    throw new Error(`Performance too slow: ${avgPerRequest}ms per request (should be <50ms)`);
  }
}

// ============================================================================
// Main execution
// ============================================================================

(async () => {
  try {
    console.log('⚡ Starting authentication tests...\n');
    console.log('⚠️  Make sure dev server is running: npm run dev\n');
    
    // Wait a moment for user to start server if needed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run tests
    await runTest('Test 1: Successful Login', test1_LoginSuccess);
    await runTest('Test 2: Invalid Password', test2_LoginInvalidPassword);
    await runTest('Test 3: Protected Endpoint (With Token)', test3_ProtectedEndpointWithToken);
    await runTest('Test 4: Protected Endpoint (Without Token)', test4_ProtectedEndpointWithoutToken);
    await runTest('Test 5: User Access Own Resource', test5_UserAccessOwnResource);
    await runTest('Test 6: User Access Other Resource (CRITICAL)', test6_UserAccessOtherResource);
    await runTest('Test 7: Super Admin Override', test7_SuperAdminOverride);
    await runTest('Test 8: Super Admin Endpoint', test8_SuperAdminEndpoint);
    await runTest('Test 9: Invalid Username (Security)', test9_InvalidUsername);
    await runTest('Test 10: Token Expiry', test10_TokenExpiry);
    await runTest('Test 11: Performance (1000 requests)', test11_Performance1000Requests);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testsPassed}/11`);
    console.log(`❌ Failed: ${testsFailed}/11`);
    
    if (testsFailed === 0) {
      console.log('\n🎉 SUCCESS! All tests passed. Spike 2 validation complete!');
      console.log('✅ JWT authentication is working correctly.');
      console.log('✅ Route protection is enforced.');
      console.log('✅ Ownership verification prevents cross-user access.');
      console.log('✅ Performance is acceptable (<50ms per request).');
      console.log('\n🚀 Next step: Begin Spike 3 (Spotify Multi-Tenancy)');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Review errors above and fix before proceeding.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('\n💡 Is the dev server running? Try: npm run dev');
    process.exit(1);
  }
})();
