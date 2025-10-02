/**
 * Database-based caching system using Neon PostgreSQL
 * Replaces Vercel KV with a simple, reliable database cache
 */

import { db } from '@/lib/db';

export interface CacheEntry {
  key: string;
  value: any;
  expires_at: Date;
  created_at: Date;
}

export class DatabaseCache {
  private tableName = 'cache_entries';

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const result = await db.execute(`
        SELECT value, expires_at 
        FROM ${this.tableName} 
        WHERE key = $1 AND expires_at > NOW()
      `, [key]);

      if (result.rows.length === 0) {
        return null;
      }

      const { value, expires_at } = result.rows[0];
      
      // Check if expired
      if (new Date(expires_at) <= new Date()) {
        await this.delete(key);
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const serializedValue = JSON.stringify(value);

      await db.execute(`
        INSERT INTO ${this.tableName} (key, value, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
      `, [key, serializedValue, expiresAt]);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await db.execute(`
        DELETE FROM ${this.tableName} 
        WHERE key = $1
      `, [key]);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all expired entries
   */
  async clearExpired(): Promise<void> {
    try {
      await db.execute(`
        DELETE FROM ${this.tableName} 
        WHERE expires_at <= NOW()
      `);
    } catch (error) {
      console.error('Cache clear expired error:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      await db.execute(`DELETE FROM ${this.tableName}`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    memoryUsage: number;
  }> {
    try {
      const totalResult = await db.execute(`
        SELECT COUNT(*) as total FROM ${this.tableName}
      `);
      
      const expiredResult = await db.execute(`
        SELECT COUNT(*) as expired FROM ${this.tableName} 
        WHERE expires_at <= NOW()
      `);

      const sizeResult = await db.execute(`
        SELECT SUM(LENGTH(value)) as size FROM ${this.tableName}
      `);

      return {
        totalEntries: parseInt(totalResult.rows[0]?.total || '0'),
        expiredEntries: parseInt(expiredResult.rows[0]?.expired || '0'),
        memoryUsage: parseInt(sizeResult.rows[0]?.size || '0')
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { totalEntries: 0, expiredEntries: 0, memoryUsage: 0 };
    }
  }
}

// Create cache table if it doesn't exist
export async function initializeCacheTable(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires 
      ON cache_entries (expires_at)
    `);
  } catch (error) {
    console.error('Failed to initialize cache table:', error);
  }
}

// Export singleton instance
export const databaseCache = new DatabaseCache();
