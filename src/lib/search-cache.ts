/**
 * Process-local short-TTL cache for guest Spotify search results.
 * Cuts duplicate Search API calls during parties when many guests type the same query.
 */

const DEFAULT_TTL_MS = 45 * 1000;
const MAX_ENTRIES = 200;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function buildSearchCacheKey(
  userId: string | null | undefined,
  query: string,
  limit: number
): string {
  const normalized = query.trim().toLowerCase();
  return `${userId || 'anon'}|${normalized}|${limit}`;
}

function evictExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function evictOldestIfNeeded(): void {
  if (store.size < MAX_ENTRIES) return;
  const oldestKey = store.keys().next().value;
  if (oldestKey !== undefined) {
    store.delete(oldestKey);
  }
}

export function getCachedSearch<T>(key: string): T | null {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  // Refresh insertion order for simple LRU-ish behavior
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function setCachedSearch<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const now = Date.now();
  evictExpired(now);
  evictOldestIfNeeded();
  store.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
}

/** Test helper */
export function resetSearchCacheForTests(): void {
  store.clear();
}
