/**
 * Display Flow Tests
 *
 * Tests the display screen functionality via supported public APIs:
 * - Access display screen with username
 * - Verify public/guest display endpoints (legacy /api/display/* is 410)
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

  // Test 2: Legacy display current API is retired
  await runTest(results, '2. Legacy display current returns 410', async () => {
    console.log('   📡 Testing retired /api/display/current');

    const response = await fetch(
      `${baseURL}/api/display/current?username=testuser1`
    );

    if (response.status !== 410) {
      throw new Error(`Expected 410 Gone, got ${response.status}`);
    }

    const data = await response.json();
    if (data.current_track !== undefined || data.event_settings !== undefined) {
      throw new Error('Legacy display endpoint must not return event data');
    }
    console.log('   ✅ Legacy display current retired (410)');
  });

  // Test 3: Legacy display requests API is retired
  await runTest(results, '3. Legacy display requests returns 410', async () => {
    console.log('   📋 Testing retired /api/display/requests');

    const response = await fetch(`${baseURL}/api/display/requests`);

    if (response.status !== 410) {
      throw new Error(`Expected 410 Gone, got ${response.status}`);
    }

    const data = await response.json();
    if (
      data.approved_requests !== undefined ||
      data.recently_played_requests !== undefined
    ) {
      throw new Error('Legacy display requests must not return request data');
    }
    console.log('   ✅ Legacy display requests retired (410)');
  });

  // Test 4: Supported public event-config responds
  await runTest(results, '4. Public event-config API responds', async () => {
    console.log('   📡 Testing /api/public/event-config');

    const response = await fetch(
      `${baseURL}/api/public/event-config?username=testuser1`
    );

    if (![200, 400, 401, 403, 404].includes(response.status)) {
      throw new Error(`Public event-config returned unexpected ${response.status}`);
    }
    console.log(`   ✅ Public event-config responds (${response.status})`);
  });

  results.duration = (Date.now() - suiteStart) / 1000;

  console.log(
    `\n🏁 Display Flow Tests Complete: ${results.passed}/${results.tests.length} passed\n`
  );

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
