/**
 * Jest Global Setup
 * 
 * Runs before all tests to configure the test environment
 */

import '@testing-library/jest-dom';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: './test.env' });

// Increase timeout for integration tests
jest.setTimeout(30000); // 30 seconds

// Mock console methods in tests to reduce noise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).console = {
  ...console,
  // Keep error and warn for debugging
  // Suppress log, debug, info in tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Global test utilities
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock fetch globally if needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).fetch = (global as any).fetch || jest.fn();

// Setup global test helpers
beforeAll(() => {
  console.error('🧪 Starting test suite...');
});

afterAll(() => {
  console.error('✅ Test suite completed');
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});


