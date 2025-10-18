import type { Config } from 'jest';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: './test.env' });

const config: Config = {
  displayName: 'Unit Tests',
  testEnvironment: 'jsdom',
  rootDir: '../..',
  testMatch: [
    '<rootDir>/tests/unit/**/*.spec.ts',
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/src/components/**/__tests__/**/*.(spec|test).tsx',
    '<rootDir>/src/components/**/__tests__/**/*.(spec|test).ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
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
    'src/lib/**/*.{ts,tsx}',
    '!src/lib/**/*.d.ts',
    '!src/lib/**/index.ts', // Usually just exports
  ],
  coverageDirectory: 'test-results/coverage-unit',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 15000, // 15 seconds per test
  verbose: true,
  bail: false,
  maxWorkers: '50%',
  passWithNoTests: true, // Don't fail when no tests are found
};

export default config;

