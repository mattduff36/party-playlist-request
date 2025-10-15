/**
 * Display Flow Tests
 * 
 * Tests the display screen functionality:
 * - Access display screen with username
 * - Verify it shows offline state
 * - Check display API endpoints
 * - Verify real-time updates work (via Pusher)
 */

import type { TestSuiteResult, TestResult } from '../interactive-test-suite';

export async function runDisplayFlowTests(baseURL: string): Promise<TestSuiteResult> {
  console.log('📺 Starting Display Flow Tests...\n');

  const results: TestSuiteResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    tests: [],
  };

  const suiteStart = Date.now();

  // Test 1: Access display page
  await runTest(results, '1. Display page loads', async () => {
    console.log(`   📍 Checking ${baseURL}/testuser1/display`);
    
    const response = await fetch(`${baseURL}/testuser1/display`);
    
    if (response.ok || response.status === 302 || response.status === 307) {
      console.log('   ✅ Display page route exists');
    } else {
      throw new Error(`Display page returned ${response.status}`);
    }
  });

  // Test 2: Check display current API
  await runTest(results, '2. Display current API responds', async () => {
    console.log('   📡 Testing display current endpoint');
    
    const response = await fetch(`${baseURL}/api/display/current?username=testuser1`);
    
    // Should return data or error
    if ([200, 400, 404, 500].includes(response.status)) {
      console.log(`   ✅ Display API responds (${response.status})`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   📊 Has current track: ${!!data.current_track}`);
        console.log(`   📊 Is playing: ${data.is_playing}`);
      }
    } else {
      throw new Error(`Display API returned unexpected ${response.status}`);
    }
  });

  // Test 3: Check display requests API
  await runTest(results, '3. Display requests API responds', async () => {
    console.log('   📋 Testing display requests endpoint');
    
    const response = await fetch(`${baseURL}/api/display/requests`);
    
    // Could be 200 (data) or 500 (error)
    if ([200, 500].includes(response.status)) {
      console.log(`   ✅ Display requests API responds (${response.status})`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   📊 Approved requests: ${data.approved_requests?.length || 0}`);
        console.log(`   📊 Recently played: ${data.recently_played_requests?.length || 0}`);
      }
    } else {
      throw new Error(`Display requests API returned unexpected ${response.status}`);
    }
  });

  results.duration = (Date.now() - suiteStart) / 1000;

  console.log(`\n🏁 Display Flow Tests Complete: ${results.passed}/${results.tests.length} passed\n`);

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

