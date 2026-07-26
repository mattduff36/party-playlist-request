import type { Config } from 'jest';

// Component tests need React's development build (`React.act`).
// Finalise may inherit NODE_ENV=production from .env.local.
process.env.NODE_ENV = 'test';
import * as dotenv from 'dotenv';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });
dotenv.config({ path: path.join(repoRoot, 'config/jest/test.env'), quiet: true });

const sharedTransform = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  ],
};

const config: Config = {
  displayName: 'Unit Tests',
  rootDir: repoRoot,
  projects: [
    {
      displayName: 'unit-node',
      testEnvironment: 'node',
      rootDir: repoRoot,
      testMatch: [
        '<rootDir>/tests/unit/**/*.spec.ts',
        '<rootDir>/tests/unit/**/*.test.ts',
        '<rootDir>/tests/security/**/*.spec.ts',
        '<rootDir>/tests/security/**/*.test.ts',
      ],
      transform: sharedTransform,
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^server-only$': '<rootDir>/config/jest/server-only-mock.js',
      },
      setupFilesAfterEnv: ['<rootDir>/config/jest/jest.setup.ts'],
    },
    {
      displayName: 'unit-components',
      testEnvironment: 'jsdom',
      rootDir: repoRoot,
      testMatch: ['<rootDir>/src/**/__tests__/**/*.{ts,tsx}'],
      transform: sharedTransform,
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^server-only$': '<rootDir>/config/jest/server-only-mock.js',
        '\\.(css|less|scss|sass)$': '<rootDir>/config/jest/style-mock.js',
      },
      setupFilesAfterEnv: ['<rootDir>/config/jest/jest.setup.ts'],
    },
  ],
  coverageDirectory: 'test-results/coverage-unit',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 15000,
  verbose: true,
  bail: false,
  maxWorkers: '50%',
  passWithNoTests: true,
};

export default config;
