/**
 * Playwright global teardown: remove seed accounts created by this run.
 */

import { cleanupSeededTestUsers } from '../scripts/cleanup-test-data';

async function globalTeardown(): Promise<void> {
  console.log('\nCleaning up seed test users created by this run...');
  try {
    await cleanupSeededTestUsers();
  } catch (error) {
    // Do not fail the suite on cleanup errors (e.g. missing DATABASE_URL in CI artifacts).
    console.warn('Seed user cleanup skipped or failed:', error);
  }
}

export default globalTeardown;
