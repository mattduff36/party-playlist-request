import { groupIntoPatterns, type ErrorLogEntry } from '@/lib/support/error-patterns';

function makeError(partial: Partial<ErrorLogEntry> & { id: string }): ErrorLogEntry {
  return {
    timestamp: '2026-07-25T15:30:00.000Z',
    lastSeen: '2026-07-25T15:30:00.000Z',
    error_message: 'Spotify API 429 on GET /me/player/devices',
    error_stack: null,
    error_type: 'error',
    user_id: 'user-1',
    user_email: null,
    page_url: '/me/player/devices',
    user_agent: '',
    component_name: 'spotify',
    additional_data: { status: 429, throttled: true },
    fingerprint: 'spotify|429|/me/player/devices|Spotify API 429 on GET /me/player/devices|',
    occurrence_count: 1,
    classification: 'handled',
    ...partial,
  };
}

describe('groupIntoPatterns', () => {
  it('clusters identical handled 429s into one pattern with summed hits', () => {
    const errors = Array.from({ length: 50 }, (_, i) =>
      makeError({
        id: `id-${i}`,
        occurrence_count: i === 0 ? 100 : 1,
        lastSeen: `2026-07-25T15:${String(30 + (i % 20)).padStart(2, '0')}:00.000Z`,
      })
    );

    const patterns = groupIntoPatterns(errors);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].totalOccurrences).toBe(149);
    expect(patterns[0].rowCount).toBe(50);
    expect(patterns[0].classification).toBe('handled');
    expect(patterns[0].actionable).toBe(false);
    expect(patterns[0].allErrorIds).toHaveLength(50);
    expect(patterns[0].occurrences.length).toBeLessThanOrEqual(12);
  });

  it('keeps distinct messages as separate clusters', () => {
    const errors = [
      makeError({ id: 'a' }),
      makeError({
        id: 'b',
        error_message: 'Spotify API 429 on GET /me/player',
        page_url: '/me/player',
        fingerprint: 'spotify|429|/me/player|Spotify API 429 on GET /me/player|',
      }),
    ];
    const patterns = groupIntoPatterns(errors);
    expect(patterns).toHaveLength(2);
  });
});
