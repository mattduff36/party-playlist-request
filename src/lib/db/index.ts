import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { getConnectionPoolManager, PoolType } from './connection-pool';
import { getDatabaseService } from './database-service';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Edge-compatible database connection (for API routes)
export const db = drizzle(neon(NEON_DATABASE_URL!), { schema });

// Connection pool manager (for server-side operations)
export const poolManager = getConnectionPoolManager();

// Database service with connection pooling
export const dbService = getDatabaseService();

// Legacy compatibility - use the new database service
export const dbNode = dbService;

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
