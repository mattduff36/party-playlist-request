#!/usr/bin/env node

/**
 * Load Testing CLI Tool
 * 
 * This script provides a command-line interface for running load tests
 * and generating performance reports.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
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

function log(message, color = 'reset') {
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

// Available scenarios
const scenarios = [
  'basic-user',
  'high-load',
  'stress-test',
  'real-time-sync',
  'memory-leak'
];

// Available benchmarks
const benchmarks = [
  'basic-performance',
  'high-load-performance',
  'stress-test-performance',
  'memory-leak-detection',
  'real-time-performance'
];

function showHelp() {
  logHeader('Load Testing CLI Tool');
  log('Usage: npm run load-test [options]', 'bright');
  log('');
  log('Options:', 'bright');
  log('  --scenario <name>     Load test scenario to run');
  log('  --benchmark <name>    Benchmark to evaluate against');
  log('  --users <number>      Number of concurrent users');
  log('  --duration <seconds>  Test duration in seconds');
  log('  --ramp-up <seconds>   User ramp-up time in seconds');
  log('  --base-url <url>      Base URL for the application');
  log('  --output <file>       Output file for results');
  log('  --list-scenarios      List available scenarios');
  log('  --list-benchmarks     List available benchmarks');
  log('  --help                Show this help message');
  log('');
  log('Examples:', 'bright');
  log('  npm run load-test --scenario basic-user --users 100 --duration 300');
  log('  npm run load-test --scenario high-load --benchmark high-load-performance');
  log('  npm run load-test --list-scenarios');
  log('');
}

function listScenarios() {
  logHeader('Available Scenarios');
  scenarios.forEach((scenario, index) => {
    log(`${index + 1}. ${scenario}`, 'green');
  });
  log('');
}

function listBenchmarks() {
  logHeader('Available Benchmarks');
  benchmarks.forEach((benchmark, index) => {
    log(`${index + 1}. ${benchmark}`, 'green');
  });
  log('');
}

function validateScenario(scenario) {
  if (!scenarios.includes(scenario)) {
    logError(`Invalid scenario: ${scenario}`);
    logInfo(`Available scenarios: ${scenarios.join(', ')}`);
    process.exit(1);
  }
}

function validateBenchmark(benchmark) {
  if (!benchmarks.includes(benchmark)) {
    logError(`Invalid benchmark: ${benchmark}`);
    logInfo(`Available benchmarks: ${benchmarks.join(', ')}`);
    process.exit(1);
  }
}

function validateNumber(value, name, min = 1) {
  const num = parseInt(value);
  if (isNaN(num) || num < min) {
    logError(`Invalid ${name}: ${value}. Must be a number >= ${min}`);
    process.exit(1);
  }
  return num;
}

function validateUrl(url) {
  try {
    new URL(url);
    return url;
  } catch (error) {
    logError(`Invalid URL: ${url}`);
    process.exit(1);
  }
}

async function runLoadTest(options) {
  logHeader('Starting Load Test');
  
  const {
    scenario,
    benchmark,
    users,
    duration,
    rampUp,
    baseUrl,
    output
  } = options;

  logInfo(`Scenario: ${scenario}`);
  logInfo(`Users: ${users}`);
  logInfo(`Duration: ${duration}s`);
  logInfo(`Ramp-up: ${rampUp}s`);
  logInfo(`Base URL: ${baseUrl}`);
  
  if (benchmark) {
    logInfo(`Benchmark: ${benchmark}`);
  }
  
  if (output) {
    logInfo(`Output: ${output}`);
  }

  // Create test configuration
  const testConfig = {
    scenario,
    users,
    duration,
    rampUp,
    baseUrl,
    benchmark,
    output
  };

  // Write config to temporary file
  const configFile = path.join(__dirname, '..', 'temp-load-test-config.json');
  fs.writeFileSync(configFile, JSON.stringify(testConfig, null, 2));

  try {
    // Run the load test
    const testScript = path.join(__dirname, '..', 'src', 'lib', 'load-testing', 'run-test.js');
    
    logInfo('Executing load test...');
    log('');

    const child = spawn('node', [testScript, configFile], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    return new Promise((resolve, reject) => {
      child.on('close', (code) => {
        // Clean up config file
        if (fs.existsSync(configFile)) {
          fs.unlinkSync(configFile);
        }

        if (code === 0) {
          logSuccess('Load test completed successfully');
          resolve();
        } else {
          logError(`Load test failed with exit code ${code}`);
          reject(new Error(`Load test failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        logError(`Failed to start load test: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    logError(`Load test execution failed: ${error.message}`);
    process.exit(1);
  }
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    scenario: 'basic-user',
    users: 100,
    duration: 300,
    rampUp: 60,
    baseUrl: 'http://localhost:3000',
    benchmark: null,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
        
      case '--list-scenarios':
        listScenarios();
        process.exit(0);
        break;
        
      case '--list-benchmarks':
        listBenchmarks();
        process.exit(0);
        break;
        
      case '--scenario':
        options.scenario = args[++i];
        break;
        
      case '--benchmark':
        options.benchmark = args[++i];
        break;
        
      case '--users':
        options.users = validateNumber(args[++i], 'users');
        break;
        
      case '--duration':
        options.duration = validateNumber(args[++i], 'duration');
        break;
        
      case '--ramp-up':
        options.rampUp = validateNumber(args[++i], 'ramp-up');
        break;
        
      case '--base-url':
        options.baseUrl = validateUrl(args[++i]);
        break;
        
      case '--output':
        options.output = args[++i];
        break;
        
      default:
        logError(`Unknown option: ${arg}`);
        logInfo('Use --help for usage information');
        process.exit(1);
    }
  }

  return options;
}

async function main() {
  try {
    const options = parseArguments();
    
    // Validate options
    validateScenario(options.scenario);
    if (options.benchmark) {
      validateBenchmark(options.benchmark);
    }
    
    // Run the load test
    await runLoadTest(options);
    
  } catch (error) {
    logError(`Load test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runLoadTest,
  parseArguments,
  showHelp,
  listScenarios,
  listBenchmarks
};

