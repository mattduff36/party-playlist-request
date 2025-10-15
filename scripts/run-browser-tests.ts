#!/usr/bin/env tsx
/**
 * Browser Test Runner
 * 
 * Orchestrates the entire browser test suite:
 * 1. Ensures dev server is running
 * 2. Waits for server to be ready
 * 3. Runs interactive browser tests
 * 4. Reports results
 * 
 * Usage:
 *   npm run test:browser
 *   npm run test:browser -- --flow=dj
 *   npm run test:browser -- --flow=guest
 */

import { spawn, ChildProcess } from 'child_process';
import { runInteractiveBrowserTests } from '../tests/browser/interactive-test-suite';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SERVER_READY_TIMEOUT = 30000; // 30 seconds

async function waitForServer(url: string, timeout: number): Promise<boolean> {
  const start = Date.now();
  
  console.log(`⏳ Waiting for server at ${url}...`);
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        console.log(`✅ Server is ready at ${url}\n`);
        return true;
      }
    } catch (error) {
      // Server not ready yet, keep waiting
    }
    
    // Wait 500ms before next check
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error(`❌ Server not ready after ${timeout}ms`);
  return false;
}

async function checkServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n🚀 ================================================');
  console.log('   BROWSER TEST SUITE RUNNER');
  console.log('================================================\n');

  // Check if server is already running
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.log('⚠️  Dev server is not running.');
    console.log('   Please start the dev server first with: npm run dev\n');
    process.exit(1);
  }

  // Wait for server to be fully ready
  const ready = await waitForServer(BASE_URL, SERVER_READY_TIMEOUT);
  
  if (!ready) {
    console.error('❌ Server failed to become ready. Exiting.');
    process.exit(1);
  }

  // Run the interactive browser tests
  try {
    const results = await runInteractiveBrowserTests(BASE_URL);
    
    // Exit with appropriate code
    if (results.failed > 0) {
      console.log('\n💡 To fix and re-run:');
      console.log('   1. Fix the issues identified above');
      console.log('   2. Run: npm run test:browser');
      console.log('   3. Verify all tests pass\n');
      process.exit(1);
    } else {
      console.log('\n🎉 All browser tests passed successfully!\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Test suite crashed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

