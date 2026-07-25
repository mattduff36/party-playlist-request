/**
 * Cache system exports
 * Uses database-based caching instead of Vercel KV
 */

import {
  DatabaseCache,
  databaseCache,
  initializeCacheTable,
} from './database-cache';
import type { CacheEntry } from './database-cache';

export { DatabaseCache, databaseCache, initializeCacheTable };
export type { CacheEntry };

// For backward compatibility, export as "vercel-kv" equivalent
export const getVercelKVClient = () => databaseCache;
export const getCacheClient = () => databaseCache;
