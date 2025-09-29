#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * This script provides different test configurations for different types of testing:
 * - Unit tests: Fast, isolated tests with mocks
 * - Integration tests: Tests with real services
 * - Component tests: React component tests
 * - E2E tests: Full application tests
 */

const { spawn } = require('child_process');
const path = require('path');

const testTypes = {
  unit: {
    config: 'jest.config.js',
    pattern: '**/__tests__/**/*.test.{ts,tsx}',
    description: 'Unit tests with mocks'
  },
  integration: {
    config: 'jest.config.integration.js',
    pattern: '**/__tests__/comprehensive.test.ts',
    description: 'Integration tests with real services'
  },
  components: {
    config: 'jest.config.js',
    pattern: '**/components/**/*.test.tsx',
    description: 'React component tests'
  },
  all: {
    config: 'jest.config.js',
    pattern: '**/__tests__/**/*.test.{ts,tsx}',
    description: 'All tests'
  }
};

function runTests(type = 'all', options = {}) {
  const testConfig = testTypes[type];
  
  if (!testConfig) {
    console.error(`❌ Unknown test type: ${type}`);
    console.error(`Available types: ${Object.keys(testTypes).join(', ')}`);
    process.exit(1);
  }

  console.log(`🧪 Running ${testConfig.description}...`);
  
  const args = [
    '--config', testConfig.config,
    '--testPathPatterns', testConfig.pattern,
    '--verbose',
    '--detectOpenHandles',
    '--forceExit'
  ];

  if (options.watch) {
    args.push('--watch');
  }

  if (options.coverage) {
    args.push('--coverage');
  }

  if (options.updateSnapshots) {
    args.push('--updateSnapshot');
  }

  const jest = spawn('npm', ['test', ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  jest.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ ${testConfig.description} completed successfully`);
    } else {
      console.error(`❌ ${testConfig.description} failed with code ${code}`);
      process.exit(code);
    }
  });

  jest.on('error', (error) => {
    console.error(`❌ Failed to start Jest: ${error.message}`);
    process.exit(1);
  });
}

function showHelp() {
  console.log(`
🧪 Party Playlist Test Runner

Usage: node scripts/test-runner.js [type] [options]

Types:
  unit        Unit tests with mocks (default)
  integration Integration tests with real services
  components  React component tests
  all         All tests

Options:
  --watch           Watch mode
  --coverage        Generate coverage report
  --update-snapshots Update snapshots
  --help           Show this help

Examples:
  node scripts/test-runner.js unit
  node scripts/test-runner.js integration --coverage
  node scripts/test-runner.js components --watch
  node scripts/test-runner.js all --coverage
`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const type = args[0] || 'all';
const options = {};

// Parse options
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--watch':
      options.watch = true;
      break;
    case '--coverage':
      options.coverage = true;
      break;
    case '--update-snapshots':
      options.updateSnapshots = true;
      break;
    case '--help':
      showHelp();
      process.exit(0);
      break;
    default:
      console.error(`❌ Unknown option: ${arg}`);
      showHelp();
      process.exit(1);
  }
}

// Run the tests
runTests(type, options);
