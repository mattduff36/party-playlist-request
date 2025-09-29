#!/usr/bin/env node

/**
 * Load Test Runner
 * 
 * This script runs load tests for the party playlist system
 * to ensure it can handle 350+ concurrent users.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load configuration
const config = require('../load-test.config.js');

class LoadTestRunner {
  constructor() {
    this.results = {
      startTime: null,
      endTime: null,
      scenarios: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        memoryUsage: [],
        cpuUsage: []
      }
    };
  }

  async runAllScenarios() {
    console.log('🚀 Starting Load Test Suite for 350+ Concurrent Users\n');
    
    this.results.startTime = new Date();
    
    const scenarios = Object.keys(config.scenarios);
    
    for (const scenarioName of scenarios) {
      console.log(`\n📊 Running Scenario: ${scenarioName}`);
      console.log(`   ${config.scenarios[scenarioName].description}`);
      
      try {
        await this.runScenario(scenarioName);
        console.log(`   ✅ ${scenarioName} completed successfully`);
      } catch (error) {
        console.error(`   ❌ ${scenarioName} failed: ${error.message}`);
        this.results.summary.failedTests++;
      }
      
      this.results.summary.totalTests++;
    }
    
    this.results.endTime = new Date();
    this.generateReport();
  }

  async runScenario(scenarioName) {
    const scenario = config.scenarios[scenarioName];
    const startTime = Date.now();
    
    // Run the performance test
    const testResult = await this.runPerformanceTest(scenario);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Store results
    this.results.scenarios[scenarioName] = {
      ...testResult,
      duration,
      timestamp: new Date().toISOString()
    };
    
    // Update summary
    this.updateSummary(testResult);
    
    // Check thresholds
    this.checkThresholds(scenarioName, testResult);
  }

  async runPerformanceTest(scenario) {
    return new Promise((resolve, reject) => {
      const args = [
        'test',
        '--config', 'jest.config.integration.js',
        '--testPathPatterns', 'src/__tests__/performance.test.ts',
        '--verbose',
        '--detectOpenHandles',
        '--forceExit'
      ];

      const jest = spawn('npm', args, {
        stdio: 'pipe',
        cwd: process.cwd(),
        env: {
          ...process.env,
          LOAD_TEST_SCENARIO: scenario.name,
          LOAD_TEST_USERS: scenario.users,
          LOAD_TEST_DURATION: scenario.duration
        }
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      jest.on('close', (code) => {
        if (code === 0) {
          // Parse test results from output
          const results = this.parseTestResults(output);
          resolve(results);
        } else {
          reject(new Error(`Test failed with code ${code}: ${errorOutput}`));
        }
      });

      jest.on('error', (error) => {
        reject(new Error(`Failed to start test: ${error.message}`));
      });
    });
  }

  parseTestResults(output) {
    // Parse Jest output to extract performance metrics
    const lines = output.split('\n');
    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      memoryUsage: [],
      cpuUsage: []
    };

    // Look for performance metrics in the output
    for (const line of lines) {
      if (line.includes('Total Requests:')) {
        const match = line.match(/Total Requests: (\d+)/);
        if (match) results.totalRequests = parseInt(match[1]);
      }
      
      if (line.includes('Successful Requests:')) {
        const match = line.match(/Successful Requests: (\d+)/);
        if (match) results.successfulRequests = parseInt(match[1]);
      }
      
      if (line.includes('Failed Requests:')) {
        const match = line.match(/Failed Requests: (\d+)/);
        if (match) results.failedRequests = parseInt(match[1]);
      }
      
      if (line.includes('Average Response Time:')) {
        const match = line.match(/Average Response Time: ([\d.]+)ms/);
        if (match) results.averageResponseTime = parseFloat(match[1]);
      }
      
      if (line.includes('Max Response Time:')) {
        const match = line.match(/Max Response Time: ([\d.]+)ms/);
        if (match) results.maxResponseTime = parseFloat(match[1]);
      }
      
      if (line.includes('Min Response Time:')) {
        const match = line.match(/Min Response Time: ([\d.]+)ms/);
        if (match) results.minResponseTime = parseFloat(match[1]);
      }
      
      if (line.includes('Peak Memory Usage:')) {
        const match = line.match(/Peak Memory Usage: ([\d.]+)MB/);
        if (match) results.memoryUsage.push(parseFloat(match[1]) * 1024 * 1024);
      }
    }

    return results;
  }

  updateSummary(testResult) {
    this.results.summary.totalRequests += testResult.totalRequests;
    this.results.summary.successfulRequests += testResult.successfulRequests;
    this.results.summary.failedRequests += testResult.failedRequests;
    
    if (testResult.averageResponseTime > 0) {
      this.results.summary.averageResponseTime = 
        (this.results.summary.averageResponseTime + testResult.averageResponseTime) / 2;
    }
    
    this.results.summary.maxResponseTime = Math.max(
      this.results.summary.maxResponseTime, 
      testResult.maxResponseTime
    );
    
    this.results.summary.minResponseTime = Math.min(
      this.results.summary.minResponseTime, 
      testResult.minResponseTime
    );
    
    this.results.summary.memoryUsage.push(...testResult.memoryUsage);
    this.results.summary.cpuUsage.push(...testResult.cpuUsage);
  }

  checkThresholds(scenarioName, testResult) {
    const thresholds = config.thresholds;
    const issues = [];

    // Check response time thresholds
    if (testResult.averageResponseTime > thresholds.responseTime.average) {
      issues.push(`Average response time ${testResult.averageResponseTime}ms exceeds threshold ${thresholds.responseTime.average}ms`);
    }

    if (testResult.maxResponseTime > thresholds.responseTime.max) {
      issues.push(`Max response time ${testResult.maxResponseTime}ms exceeds threshold ${thresholds.responseTime.max}ms`);
    }

    // Check error rate thresholds
    const errorRate = testResult.failedRequests / testResult.totalRequests;
    if (errorRate > thresholds.errorRate.max) {
      issues.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(thresholds.errorRate.max * 100).toFixed(2)}%`);
    }

    // Check memory usage thresholds
    const peakMemory = Math.max(...testResult.memoryUsage);
    if (peakMemory > thresholds.resources.memory.max) {
      issues.push(`Peak memory usage ${(peakMemory / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.resources.memory.max / 1024 / 1024).toFixed(2)}MB`);
    }

    if (issues.length > 0) {
      console.log(`   ⚠️  Threshold violations in ${scenarioName}:`);
      issues.forEach(issue => console.log(`      - ${issue}`));
    }
  }

  generateReport() {
    const duration = this.results.endTime - this.results.startTime;
    const successRate = (this.results.summary.successfulRequests / this.results.summary.totalRequests) * 100;
    
    console.log('\n📊 Load Test Summary Report');
    console.log('============================');
    console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📈 Total Requests: ${this.results.summary.totalRequests}`);
    console.log(`✅ Successful Requests: ${this.results.summary.successfulRequests}`);
    console.log(`❌ Failed Requests: ${this.results.summary.failedRequests}`);
    console.log(`📊 Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`⚡ Average Response Time: ${this.results.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`🚀 Max Response Time: ${this.results.summary.maxResponseTime.toFixed(2)}ms`);
    console.log(`🐌 Min Response Time: ${this.results.summary.minResponseTime.toFixed(2)}ms`);
    
    if (this.results.summary.memoryUsage.length > 0) {
      const peakMemory = Math.max(...this.results.summary.memoryUsage);
      console.log(`💾 Peak Memory Usage: ${(peakMemory / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.log(`\n📋 Test Results:`);
    console.log(`   Total Tests: ${this.results.summary.totalTests}`);
    console.log(`   Passed: ${this.results.summary.totalTests - this.results.summary.failedTests}`);
    console.log(`   Failed: ${this.results.summary.failedTests}`);
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Save detailed report
    this.saveDetailedReport();
  }

  generateRecommendations() {
    console.log('\n💡 Recommendations:');
    
    const successRate = (this.results.summary.successfulRequests / this.results.summary.totalRequests) * 100;
    
    if (successRate < 95) {
      console.log('   ⚠️  Success rate is below 95%. Consider:');
      console.log('      - Increasing server resources');
      console.log('      - Optimizing database queries');
      console.log('      - Implementing better error handling');
    }
    
    if (this.results.summary.averageResponseTime > 2000) {
      console.log('   ⚠️  Average response time is high. Consider:');
      console.log('      - Implementing caching strategies');
      console.log('      - Optimizing database queries');
      console.log('      - Using CDN for static assets');
    }
    
    if (this.results.summary.maxResponseTime > 10000) {
      console.log('   ⚠️  Maximum response time is very high. Consider:');
      console.log('      - Implementing request timeouts');
      console.log('      - Adding circuit breakers');
      console.log('      - Optimizing slow operations');
    }
    
    if (this.results.summary.memoryUsage.length > 0) {
      const peakMemory = Math.max(...this.results.summary.memoryUsage);
      if (peakMemory > 512 * 1024 * 1024) {
        console.log('   ⚠️  High memory usage detected. Consider:');
        console.log('      - Implementing memory monitoring');
        console.log('      - Optimizing data structures');
        console.log('      - Adding garbage collection triggers');
      }
    }
    
    if (this.results.summary.failedTests === 0) {
      console.log('   ✅ All tests passed! System is ready for 350+ concurrent users.');
    }
  }

  saveDetailedReport() {
    const reportDir = config.reporting.outputDir;
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `load-test-report-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const scenario = args[0];
  
  const runner = new LoadTestRunner();
  
  if (scenario && config.scenarios[scenario]) {
    console.log(`🚀 Running single scenario: ${scenario}`);
    await runner.runScenario(scenario);
  } else {
    console.log('🚀 Running all load test scenarios');
    await runner.runAllScenarios();
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the load tests
main().catch(console.error);
