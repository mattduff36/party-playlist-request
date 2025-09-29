import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import * as schema from './schema';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Edge-compatible database connection (for API routes)
export const db = drizzle(neon(NEON_DATABASE_URL!), { schema });

// Node.js database connection (for server-side operations)
let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// Node.js database connection with Drizzle
export const dbNode = drizzle(getPool() as any, { schema });

// Export schema for use in other files
export * from './schema';

// Database utility functions
export async function initializeDatabase() {
  try {
    // Test connection
    await db.execute('SELECT 1');
    console.log('✅ Database connection established');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Health check function
export async function checkDatabaseHealth() {
  try {
    const result = await db.execute('SELECT NOW() as current_time');
    return {
      status: 'healthy',
      timestamp: result.rows[0]?.current_time,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
