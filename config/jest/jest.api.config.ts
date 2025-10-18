import type { Config } from 'jest';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: './test.env' });

const config: Config = {
  displayName: 'API Integration Tests',
  testEnvironment: 'node',
  rootDir: '../..',
  testMatch: [
    '<rootDir>/tests/api/**/*.spec.ts',
    '<rootDir>/tests/api/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/config/jest/jest.setup.ts'],
  collectCoverageFrom: [
    'src/app/api/**/*.{ts,tsx}',
    '!src/app/api/**/*.d.ts',
    '!src/app/api/**/route.ts', // We test these via E2E
  ],
  coverageDirectory: 'test-results/coverage-api',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 30000, // 30 seconds per test
  verbose: true,
  bail: false, // Continue running tests after failures
  maxWorkers: '50%', // Use 50% of CPU cores
  passWithNoTests: true, // Don't fail when no tests are found
};

export default config;

