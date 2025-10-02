/**
 * Initialize the database cache table
 * Run this once to set up the cache table in your database
 */

import { initializeCacheTable } from './database-cache';

export async function initCache() {
  console.log('Initializing database cache table...');
  await initializeCacheTable();
  console.log('Database cache table initialized successfully!');
}

// Run if called directly
if (require.main === module) {
  initCache().catch(console.error);
}
