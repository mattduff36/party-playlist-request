/**
 * Database-based caching system using Neon PostgreSQL
 * Replaces Vercel KV with a simple, reliable database cache
 */

import { getPool } from '@/lib/db';

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
      const result = await getPool().query(
        `
        SELECT value, expires_at 
        FROM ${this.tableName} 
        WHERE key = $1 AND expires_at > NOW()
      `,
        [key]
      );

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

      await getPool().query(
        `
        INSERT INTO ${this.tableName} (key, value, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
      `,
        [key, serializedValue, expiresAt]
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await getPool().query(
        `
        DELETE FROM ${this.tableName} 
        WHERE key = $1
      `,
        [key]
      );
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all expired entries
   */
  async clearExpired(): Promise<void> {
    try {
      await getPool().query(`
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
      await getPool().query(`DELETE FROM ${this.tableName}`);
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
      const totalResult = await getPool().query(`
        SELECT COUNT(*) as total FROM ${this.tableName}
      `);

      const expiredResult = await getPool().query(`
        SELECT COUNT(*) as expired FROM ${this.tableName} 
        WHERE expires_at <= NOW()
      `);

      const sizeResult = await getPool().query(`
        SELECT SUM(LENGTH(value)) as size FROM ${this.tableName}
      `);

      return {
        totalEntries: parseInt(totalResult.rows[0]?.total || '0'),
        expiredEntries: parseInt(expiredResult.rows[0]?.expired || '0'),
        memoryUsage: parseInt(sizeResult.rows[0]?.size || '0'),
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { totalEntries: 0, expiredEntries: 0, memoryUsage: 0 };
    }
  }
}

/**
 * Verify cache table exists (PRD-05: no request-time DDL).
 * Table is created by canonical migration `004_spotify_playback_sync`.
 */
export async function initializeCacheTable(): Promise<void> {
  try {
    const result = await getPool().query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'cache_entries'
       ) AS exists`
    );
    if (!result.rows[0]?.exists) {
      console.error(
        'cache_entries missing — run npm run db:migrate:canonical (no request-time DDL)'
      );
    }
  } catch (error) {
    console.error('Failed to verify cache table:', error);
  }
}

// Export singleton instance
export const databaseCache = new DatabaseCache();
