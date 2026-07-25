/**
 * In-memory search cache unit tests
 */

import {
  buildSearchCacheKey,
  getCachedSearch,
  resetSearchCacheForTests,
  setCachedSearch,
} from '@/lib/search-cache';

describe('search-cache', () => {
  beforeEach(() => {
    resetSearchCacheForTests();
  });

  it('builds a stable normalized key', () => {
    expect(buildSearchCacheKey('u1', '  Hello ', 10)).toBe('u1|hello|10');
  });

  it('returns cached values within TTL', () => {
    const key = buildSearchCacheKey('u1', 'abba', 10);
    setCachedSearch(key, { tracks: [{ id: '1' }], query: 'abba', total: 1 });
    expect(getCachedSearch(key)).toEqual({
      tracks: [{ id: '1' }],
      query: 'abba',
      total: 1,
    });
  });

  it('expires entries after TTL', () => {
    jest.useFakeTimers();
    const key = buildSearchCacheKey('u1', 'abba', 10);
    setCachedSearch(key, { tracks: [] }, 45_000);
    jest.advanceTimersByTime(45_001);
    expect(getCachedSearch(key)).toBeNull();
    jest.useRealTimers();
  });
});
