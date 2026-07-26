/**
 * Process-local short-TTL cache for DJ Spotify playlist lists.
 * Keys MUST include the app userId so tenants never share cached playlists.
 */

const DEFAULT_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 100;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function buildPlaylistCacheKey(
  userId: string,
  spotifyUserId?: string | null
): string {
  const uid = userId.trim();
  if (!uid) {
    throw new Error('userId is required for playlist cache key');
  }
  const spotifyPart = (spotifyUserId || '').trim() || 'unknown';
  return `playlists|${uid}|${spotifyPart}`;
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

export function getCachedPlaylists<T>(key: string): T | null {
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

export function setCachedPlaylists<T>(
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

/** Drop all cached playlist lists for a single app user (any Spotify account). */
export function invalidatePlaylistCacheForUser(userId: string): void {
  const uid = userId.trim();
  if (!uid) return;
  const prefix = `playlists|${uid}|`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Test helper */
export function resetPlaylistCacheForTests(): void {
  store.clear();
}
