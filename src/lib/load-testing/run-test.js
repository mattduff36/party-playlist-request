#!/usr/bin/env node

/**
 * Load Test Execution Script
 * 
 * This script executes load tests based on configuration provided
 * via command line arguments.
 */

const { LoadTestRunner } = require('./runner');
const { 
  getScenario, 
  getBenchmark,
  evaluateBenchmark,
  generateBenchmarkReport 
} = require('./benchmarks');

// Scenario name mapping
const scenarioMap = {
  'basic-user': 'Basic User Simulation',
  'high-load': 'High Load Simulation',
  'stress-test': 'Stress Test',
  'real-time-sync': 'Real-time Synchronization Test',
  'memory-leak': 'Memory Leak Detection'
};

// Benchmark name mapping
const benchmarkMap = {
  'basic-performance': 'Basic Performance',
  'high-load-performance': 'High Load Performance',
  'stress-test-performance': 'Stress Test Performance',
  'memory-leak-detection': 'Memory Leak Detection',
  'real-time-performance': 'Real-time Performance'
};

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${message}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function displayProgress(metrics) {
  const progress = metrics.totalUsers > 0 
    ? ((metrics.completedUsers / metrics.totalUsers) * 100).toFixed(1)
    : 0;
  
  process.stdout.write(`\rProgress: ${progress}% | Users: ${metrics.activeUsers}/${metrics.totalUsers} | RPS: ${metrics.requestsPerSecond.toFixed(1)} | Errors: ${metrics.failedRequests}`);
}

function displayResults(result) {
  logHeader('Load Test Results');
  
  log(`Scenario: ${result.scenario}`, 'bright');
  log(`Duration: ${formatDuration(result.duration * 1000)}`, 'bright');
  log(`Total Users: ${result.totalUsers}`, 'bright');
  log(`Total Requests: ${result.totalRequests}`, 'bright');
  log(`Successful Requests: ${result.successfulRequests}`, 'green');
  log(`Failed Requests: ${result.failedRequests}`, 'red');
  log(`Average Response Time: ${result.averageResponseTime.toFixed(2)}ms`, 'blue');
  log(`P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`, 'blue');
  log(`P99 Response Time: ${result.p99ResponseTime.toFixed(2)}ms`, 'blue');
  log(`Requests Per Second: ${result.requestsPerSecond.toFixed(2)}`, 'blue');
  
  const errorRate = result.totalRequests > 0 
    ? ((result.failedRequests / result.totalRequests) * 100).toFixed(2)
    : 0;
  log(`Error Rate: ${errorRate}%`, result.failedRequests > 0 ? 'red' : 'green');
  
  if (result.errors.length > 0) {
    log(`\nErrors (${result.errors.length}):`, 'yellow');
    result.errors.slice(0, 10).forEach((error, index) => {
      log(`  ${index + 1}. ${error.action}: ${error.error}`, 'red');
    });
    
    if (result.errors.length > 10) {
      log(`  ... and ${result.errors.length - 10} more errors`, 'yellow');
    }
  }
}

function displayBenchmarkResults(benchmarkResults) {
  logHeader('Benchmark Evaluation');
  
  for (const benchmarkResult of benchmarkResults) {
    log(`\n${benchmarkResult.benchmark}:`, 'bright');
    log(`Status: ${benchmarkResult.passed ? 'PASSED' : 'FAILED'}`, 
         benchmarkResult.passed ? 'green' : 'red');
    log(`Score: ${benchmarkResult.score.toFixed(1)}%`, 'blue');
    
    log('\nMetrics:', 'bright');
    for (const detail of benchmarkResult.details) {
      const status = detail.passed ? '✅' : '❌';
      log(`  ${status} ${detail.metric}: ${detail.actual.toFixed(2)} / ${detail.expected}`, 
          detail.passed ? 'green' : 'red');
    }
  }
}

async function runLoadTest(config) {
  try {
    // Get scenario
    const scenarioName = scenarioMap[config.scenario];
    if (!scenarioName) {
      throw new Error(`Unknown scenario: ${config.scenario}`);
    }
    
    const scenario = getScenario(scenarioName);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioName}`);
    }
    
    // Override scenario parameters if provided
    if (config.users) scenario.userCount = config.users;
    if (config.duration) scenario.duration = config.duration;
    if (config.rampUp) scenario.rampUpTime = config.rampUp;
    
    // Create runner configuration
    const runnerConfig = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: 5000,
      maxConcurrentUsers: scenario.userCount,
      retryAttempts: 3,
      retryDelay: 1000,
      metricsInterval: 1000
    };
    
    // Create and run load test
    const runner = new LoadTestRunner(runnerConfig);
    
    logInfo(`Starting load test: ${scenario.name}`);
    logInfo(`Users: ${scenario.userCount}, Duration: ${scenario.duration}s`);
    
    const result = await runner.runScenario(
      scenario,
      displayProgress,
      (result) => {
        log('\n');
        displayResults(result);
      }
    );
    
    // Evaluate benchmarks if specified
    if (config.benchmark) {
      const benchmarkName = benchmarkMap[config.benchmark];
      if (!benchmarkName) {
        throw new Error(`Unknown benchmark: ${config.benchmark}`);
      }
      
      const benchmark = getBenchmark(benchmarkName);
      if (!benchmark) {
        throw new Error(`Benchmark not found: ${benchmarkName}`);
      }
      
      const benchmarkResult = evaluateBenchmark(benchmark, result);
      displayBenchmarkResults([benchmarkResult]);
      
      // Generate report if output file specified
      if (config.output) {
        const report = generateBenchmarkReport([benchmarkResult]);
        require('fs').writeFileSync(config.output, report);
        logSuccess(`Benchmark report saved to: ${config.output}`);
      }
    }
    
    logSuccess('Load test completed successfully');
    
  } catch (error) {
    logError(`Load test failed: ${error.message}`);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const configFile = process.argv[2];
  
  if (!configFile) {
    logError('Configuration file required');
    process.exit(1);
  }
  
  try {
    const config = JSON.parse(require('fs').readFileSync(configFile, 'utf8'));
    runLoadTest(config);
  } catch (error) {
    logError(`Failed to load configuration: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { runLoadTest };

