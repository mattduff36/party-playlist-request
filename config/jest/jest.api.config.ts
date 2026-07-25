import type { Config } from 'jest';
import * as dotenv from 'dotenv';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
dotenv.config({ path: path.join(repoRoot, '.env.local') });
dotenv.config({ path: path.join(repoRoot, 'config/jest/test.env') });

const config: Config = {
  displayName: 'API Integration Tests',
  testEnvironment: 'node',
  rootDir: repoRoot,
  testMatch: [
    '<rootDir>/tests/api/**/*.spec.ts',
    '<rootDir>/tests/api/**/*.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/config/jest/jest.setup.ts'],
  coverageDirectory: 'test-results/coverage-api',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 30000,
  verbose: true,
  bail: false,
  maxWorkers: 1,
  passWithNoTests: false,
};

export default config;
