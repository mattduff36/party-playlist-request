/**
 * Jest Global Setup
 * 
 * Runs before all tests to configure the test environment
 */

import '@testing-library/jest-dom';

(process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
import * as dotenv from 'dotenv';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });
dotenv.config({ path: path.join(repoRoot, 'config/jest/test.env'), quiet: true });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret';
}

// Increase timeout for integration tests
jest.setTimeout(30000); // 30 seconds

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // Keep error and warn for debugging
  // Suppress log, debug, info in tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Global test utilities
(globalThis as typeof globalThis & { waitFor: (ms: number) => Promise<void> }).waitFor = (
  ms: number
) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock fetch globally if needed
global.fetch = global.fetch || jest.fn();

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});


