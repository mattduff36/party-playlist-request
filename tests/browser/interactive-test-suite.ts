/**
 * Interactive Browser Test Suite
 * 
 * Uses Cursor's MCP browser automation tools to test the entire application
 * in a real browser window. You can watch as it clicks through each flow.
 * 
 * When tests fail:
 * 1. Document the error
 * 2. Fix immediately
 * 3. Re-run the failed test to verify
 * 4. Continue when verified
 */

import { runDJFlowTests } from './flows/dj-flow';
import { runGuestFlowTests } from './flows/guest-flow';
import { runDisplayFlowTests } from './flows/display-flow';

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface TestSuiteResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
}

export async function runInteractiveBrowserTests(baseURL: string): Promise<TestSuiteResult> {
  console.log('\n🎬 ===============================================');
  console.log('🌐 INTERACTIVE BROWSER TEST SUITE');
  console.log('💡 Watch the browser automate in real-time!');
  console.log(`🔗 Testing: ${baseURL}`);
  console.log('================================================\n');

  const allResults: TestSuiteResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    tests: [],
  };

  const suiteStart = Date.now();

  try {
    // Phase 1: DJ Flow Tests (Most Critical)
    console.log('\n📋 PHASE 1: DJ FLOW TESTS');
    console.log('=' .repeat(60));
    const djResults = await runDJFlowTests(baseURL);
    allResults.passed += djResults.passed;
    allResults.failed += djResults.failed;
    allResults.skipped += djResults.skipped;
    allResults.tests.push(...djResults.tests);

    if (djResults.failed > 0) {
      console.log('\n⚠️  DJ Flow tests failed. Fix issues before continuing.');
      console.log('   After fixing, re-run this test suite to verify.');
      allResults.duration = (Date.now() - suiteStart) / 1000;
      return allResults;
    }

    // Phase 2: Guest Flow Tests
    console.log('\n📋 PHASE 2: GUEST FLOW TESTS');
    console.log('='.repeat(60));
    const guestResults = await runGuestFlowTests(baseURL);
    allResults.passed += guestResults.passed;
    allResults.failed += guestResults.failed;
    allResults.skipped += guestResults.skipped;
    allResults.tests.push(...guestResults.tests);

    if (guestResults.failed > 0) {
      console.log('\n⚠️  Guest Flow tests failed. Fix issues before continuing.');
      console.log('   After fixing, re-run this test suite to verify.');
      allResults.duration = (Date.now() - suiteStart) / 1000;
      return allResults;
    }

    // Phase 3: Display Flow Tests
    console.log('\n📋 PHASE 3: DISPLAY FLOW TESTS');
    console.log('='.repeat(60));
    const displayResults = await runDisplayFlowTests(baseURL);
    allResults.passed += displayResults.passed;
    allResults.failed += displayResults.failed;
    allResults.skipped += displayResults.skipped;
    allResults.tests.push(...displayResults.tests);

  } catch (error) {
    console.error('\n❌ Test suite encountered a critical error:', error);
    allResults.failed++;
  }

  allResults.duration = (Date.now() - suiteStart) / 1000;

  printTestSummary(allResults);

  return allResults;
}

function printTestSummary(results: TestSuiteResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTERACTIVE BROWSER TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed:  ${results.passed}`);
  console.log(`❌ Failed:  ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`📝 Total:   ${results.passed + results.failed + results.skipped}`);
  console.log(`⏱️  Duration: ${results.duration.toFixed(2)}s`);
  console.log('='.repeat(60));

  if (results.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`   - ${t.name}`);
        if (t.error) console.log(`     ${t.error}`);
        if (t.screenshot) console.log(`     Screenshot: ${t.screenshot}`);
      });
    console.log('\n💡 Fix the issues above, then re-run the test suite to verify.');
  } else if (results.passed > 0) {
    console.log('\n🎉 ALL TESTS PASSED! Your application is working perfectly!');
  }
}

