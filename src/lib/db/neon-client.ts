/**
 * Neon Database Client
 * HTTP-based PostgreSQL client for serverless/edge environments
 */

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create the SQL client
export const sql = neon(process.env.DATABASE_URL);

