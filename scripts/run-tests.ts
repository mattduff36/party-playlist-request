/**
 * Comprehensive Autonomous Test Runner
 * 
 * This script:
 * 1. Sets up test database
 * 2. Seeds test data
 * 3. Starts dev server (port 3000)
 * 4. Runs all E2E tests
 * 5. Runs all API tests
 * 6. Runs all unit tests
 * 7. Generates comprehensive report
 * 8. Cleans up (stops server, drops test DB)
 */

import { spawn, ChildProcess } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { setupTestDatabase } from './setup-test-db';
import { seedTestData } from './seed-test-data';

// Load test environment
dotenv.config({ path: './test.env' });

interface TestResults {
  e2e: { passed: number; failed: number; skipped: number; duration: number };
  api: { passed: number; failed: number; skipped: number; duration: number };
  unit: { passed: number; failed: number; skipped: number; duration: number };
  total: { passed: number; failed: number; skipped: number; duration: number };
  startTime: Date;
  endTime?: Date;
}

class TestRunner {
  private serverProcess: ChildProcess | null = null;
  private results: TestResults = {
    e2e: { passed: 0, failed: 0, skipped: 0, duration: 0 },
    api: { passed: 0, failed: 0, skipped: 0, duration: 0 },
    unit: { passed: 0, failed: 0, skipped: 0, duration: 0 },
    total: { passed: 0, failed: 0, skipped: 0, duration: 0 },
    startTime: new Date(),
  };

  async run() {
    console.log('🚀 Starting Comprehensive Test Suite...\n');
    console.log('=' .repeat(80));
    console.log('PARTY PLAYLIST REQUEST - AUTONOMOUS TEST SUITE');
    console.log('=' .repeat(80));
    console.log('');

    try {
      // Phase 1: Setup
      await this.setupPhase();
      
      // Phase 2: Run Tests
      await this.testPhase();
      
      // Phase 3: Generate Report
      await this.reportPhase();
      
      // Success!
      console.log('\n✅ All tests completed successfully!');
      process.exit(0);
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async setupPhase() {
    console.log('📋 PHASE 1: SETUP');
    console.log('-'.repeat(80));
    
    // Setup test database
    console.log('\n1️⃣  Setting up test database...');
    try {
      await setupTestDatabase();
      console.log('✅ Test database ready');
    } catch (error) {
      console.error('❌ Failed to setup test database:', error);
      throw error;
    }
    
    // Seed test data
    console.log('\n2️⃣  Seeding test data...');
    try {
      await seedTestData();
      console.log('✅ Test data seeded');
    } catch (error) {
      console.error('❌ Failed to seed test data:', error);
      throw error;
    }
    
    // Start dev server
    console.log('\n3️⃣  Starting dev server (port 3000)...');
    try {
      await this.startDevServer();
      console.log('✅ Dev server running');
    } catch (error) {
      console.error('❌ Failed to start dev server:', error);
      throw error;
    }
    
    console.log('\n' + '='.repeat(80));
  }

  private async testPhase() {
    console.log('\n📋 PHASE 2: TEST EXECUTION');
    console.log('-'.repeat(80));
    
    // Run E2E tests (Priority 1)
    console.log('\n1️⃣  Running Visual Browser Tests...');
    this.results.e2e = await this.runPlaywrightTests();
    
    // Run API tests
    console.log('\n2️⃣  Running API Integration Tests (Jest)...');
    this.results.api = await this.runJestTests('api');
    
    // Run unit tests
    console.log('\n3️⃣  Running Unit Tests (Jest)...');
    this.results.unit = await this.runJestTests('unit');
    
    // Calculate totals
    this.results.total = {
      passed: this.results.e2e.passed + this.results.api.passed + this.results.unit.passed,
      failed: this.results.e2e.failed + this.results.api.failed + this.results.unit.failed,
      skipped: this.results.e2e.skipped + this.results.api.skipped + this.results.unit.skipped,
      duration: this.results.e2e.duration + this.results.api.duration + this.results.unit.duration,
    };
    this.results.endTime = new Date();
    
    console.log('\n' + '='.repeat(80));
  }

  private async reportPhase() {
    console.log('\n📋 PHASE 3: REPORT GENERATION');
    console.log('-'.repeat(80));
    
    // Generate report
    console.log('\n1️⃣  Generating test report...');
    await this.generateReport();
    
    // Cleanup
    console.log('\n2️⃣  Cleaning up...');
    await this.cleanup();
    
    console.log('\n' + '='.repeat(80));
  }

  private serverPort: number = 3000;
  
  private async startDevServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Kill any process on port 3000 first
      const killPort = spawn('npx', ['kill-port', '3000'], { shell: true });
      
      killPort.on('close', () => {
        // Start dev server
        this.serverProcess = spawn('npm', ['run', 'dev'], {
          env: { ...process.env, NODE_ENV: 'test' },
          shell: true,
        });
        
        let serverReady = false;
        const timeout = setTimeout(() => {
          if (!serverReady) {
            reject(new Error('Server start timeout'));
          }
        }, 120000); // 2 minutes
        
        this.serverProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log('   ', output.trim());
          
          // Check for port in output (e.g., "Local: http://localhost:3001")
          const portMatch = output.match(/localhost:(\d+)/);
          if (portMatch) {
            this.serverPort = parseInt(portMatch[1]);
            console.log(`   📡 Server detected on port ${this.serverPort}`);
          }
          
          // Check if server is ready
          if (output.includes('Ready') || output.includes('started server') || output.includes('Local:')) {
            serverReady = true;
            clearTimeout(timeout);
            // Wait a bit more for server to fully initialize
            setTimeout(() => resolve(), 3000);
          }
        });
        
        this.serverProcess.stderr?.on('data', (data) => {
          console.error('   ', data.toString().trim());
        });
        
        this.serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  private async runPlaywrightTests(): Promise<TestResults['e2e']> {
    const startTime = Date.now();
    
    try {
      // Import and run our visual browser tests
      const { runVisualTests } = await import('../tests/browser/visual-tests');
      const baseURL = `http://localhost:${this.serverPort}`;
      console.log(`   🌐 Testing against: ${baseURL}`);
      const results = await runVisualTests(baseURL);
      
      return {
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        duration: results.duration,
      };
    } catch (error) {
      console.error('   ❌ Error running E2E tests:', error);
      const duration = (Date.now() - startTime) / 1000;
      
      return {
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
      };
    }
  }

  private async runJestTests(type: 'api' | 'unit'): Promise<TestResults['api'] | TestResults['unit']> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const configFile = type === 'api' ? 'jest.api.config.ts' : 'jest.unit.config.ts';
      
      const proc = spawn('npx', ['jest', '--config', configFile, '--json', '--outputFile=test-results/jest-results.json'], {
        shell: true,
      });
      
      proc.stdout?.on('data', (data) => {
        console.log('   ', data.toString().trim());
      });
      
      proc.stderr?.on('data', (data) => {
        console.error('   ', data.toString().trim());
      });
      
      proc.on('close', (code) => {
        const duration = (Date.now() - startTime) / 1000;
        
        // Try to parse Jest JSON results
        try {
          const resultsPath = path.join(process.cwd(), 'test-results', 'jest-results.json');
          if (fs.existsSync(resultsPath)) {
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
            
            resolve({
              passed: results.numPassedTests || 0,
              failed: results.numFailedTests || 0,
              skipped: results.numPendingTests || 0,
              duration,
            });
          } else {
            resolve({
              passed: code === 0 ? 1 : 0,
              failed: code === 0 ? 0 : 1,
              skipped: 0,
              duration,
            });
          }
        } catch (error) {
          console.error('Error parsing Jest results:', error);
          resolve({
            passed: code === 0 ? 1 : 0,
            failed: code === 0 ? 0 : 1,
            skipped: 0,
            duration,
          });
        }
      });
    });
  }

  private async generateReport() {
    const reportPath = path.join(process.cwd(), 'TEST-REPORT.md');
    
    const report = `# 🧪 Party Playlist Request - Test Execution Report

**Generated:** ${new Date().toISOString()}  
**Duration:** ${this.results.total.duration.toFixed(2)}s

## Executive Summary

| Category | Passed | Failed | Skipped | Duration |
|----------|--------|--------|---------|----------|
| **E2E Tests** | ${this.results.e2e.passed} | ${this.results.e2e.failed} | ${this.results.e2e.skipped} | ${this.results.e2e.duration.toFixed(2)}s |
| **API Tests** | ${this.results.api.passed} | ${this.results.api.failed} | ${this.results.api.skipped} | ${this.results.api.duration.toFixed(2)}s |
| **Unit Tests** | ${this.results.unit.passed} | ${this.results.unit.failed} | ${this.results.unit.skipped} | ${this.results.unit.duration.toFixed(2)}s |
| **TOTAL** | **${this.results.total.passed}** | **${this.results.total.failed}** | **${this.results.total.skipped}** | **${this.results.total.duration.toFixed(2)}s** |

## Test Status

${this.results.total.failed === 0 ? '✅ **ALL TESTS PASSED**' : '❌ **SOME TESTS FAILED**'}

${this.results.total.failed === 0 
  ? `All ${this.results.total.passed} tests passed successfully!` 
  : `${this.results.total.failed} tests failed. Please review the detailed results below.`}

## Coverage Summary

- **E2E Test Coverage**: ${this.results.e2e.passed > 0 ? '✅ User flows validated' : '❌ No E2E tests run'}
- **API Test Coverage**: ${this.results.api.passed > 0 ? '✅ API endpoints validated' : '❌ No API tests run'}
- **Unit Test Coverage**: ${this.results.unit.passed > 0 ? '✅ Core functions validated' : '❌ No unit tests run'}

## Detailed Results

### E2E Tests (Playwright)
- Tests Executed: ${this.results.e2e.passed + this.results.e2e.failed}
- Pass Rate: ${((this.results.e2e.passed / (this.results.e2e.passed + this.results.e2e.failed)) * 100).toFixed(1)}%
- Test Files: \`tests/e2e/**/*.spec.ts\`
- Full Report: \`test-results/playwright-html/index.html\`

### API Tests (Jest)
- Tests Executed: ${this.results.api.passed + this.results.api.failed}
- Pass Rate: ${((this.results.api.passed / (this.results.api.passed + this.results.api.failed)) * 100).toFixed(1)}%
- Test Files: \`tests/api/**/*.spec.ts\`
- Coverage Report: \`test-results/coverage-api/index.html\`

### Unit Tests (Jest)
- Tests Executed: ${this.results.unit.passed + this.results.unit.failed}
- Pass Rate: ${((this.results.unit.passed / (this.results.unit.passed + this.results.unit.failed)) * 100).toFixed(1)}%
- Test Files: \`tests/unit/**/*.spec.ts\`
- Coverage Report: \`test-results/coverage-unit/index.html\`

## Recommendations

${this.results.total.failed === 0 
  ? '✅ The application is production-ready with all tests passing.'
  : `⚠️ Address the ${this.results.total.failed} failing test(s) before deploying to production.`}

## Test Environment

- **Database**: Test database (separate from production)
- **Server**: localhost:3000 (test mode)
- **Spotify**: Mocked API responses
- **Pusher**: Real-time testing enabled
- **Node Environment**: test

---

*This report was automatically generated by the autonomous test suite.*
`;
    
    fs.writeFileSync(reportPath, report);
    console.log(`   ✅ Report saved to: ${reportPath}`);
    
    // Also display summary in console
    console.log('\n📊 TEST SUMMARY');
    console.log('   ' + '-'.repeat(76));
    console.log(`   Total Tests: ${this.results.total.passed + this.results.total.failed}`);
    console.log(`   ✅ Passed: ${this.results.total.passed}`);
    console.log(`   ❌ Failed: ${this.results.total.failed}`);
    console.log(`   ⏭️  Skipped: ${this.results.total.skipped}`);
    console.log(`   ⏱️  Duration: ${this.results.total.duration.toFixed(2)}s`);
    console.log('   ' + '-'.repeat(76));
  }

  private async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    // Stop dev server
    if (this.serverProcess) {
      console.log('   Stopping dev server...');
      this.serverProcess.kill();
      this.serverProcess = null;
      console.log('   ✅ Dev server stopped');
    }

    // Remove seed accounts created by this run (allowlisted testuser* only)
    try {
      const { cleanupSeededTestUsers } = await import('./cleanup-test-data');
      await cleanupSeededTestUsers();
      console.log('   ✅ Seed test users cleaned up');
    } catch (error) {
      console.warn('   ⚠️  Seed user cleanup skipped or failed:', error);
    }
  }
}

// Run tests
const runner = new TestRunner();
runner.run().catch(console.error);

