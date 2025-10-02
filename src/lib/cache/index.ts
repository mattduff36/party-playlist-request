/**
 * Cache system exports
 * Uses database-based caching instead of Vercel KV
 */

export { DatabaseCache, databaseCache, initializeCacheTable } from './database-cache';
export type { CacheEntry } from './database-cache';

// For backward compatibility, export as "vercel-kv" equivalent
export const getVercelKVClient = () => databaseCache;
export const getCacheClient = () => databaseCache;
