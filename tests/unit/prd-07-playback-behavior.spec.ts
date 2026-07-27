/**
 * PRD-07 FIX_THEN_MERGE: behavioral tests for mode switch, capability 501,
 * and version-safe reorder conflicts.
 */

const queryMock = jest.fn();
const clientQueryMock = jest.fn();
const releaseMock = jest.fn();
const emitSecurityAuditMock = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => queryMock(...args),
    connect: async () => ({
      query: (...args: unknown[]) => clientQueryMock(...args),
      release: () => releaseMock(),
    }),
  }),
}));

jest.mock('@/lib/auth/security-audit', () => ({
  emitSecurityAudit: (...args: unknown[]) => emitSecurityAuditMock(...args),
}));

import { setPlaybackMode, reorderAppOwnedQueue } from '@/lib/playback';
import { refuseIfCapabilityUnsupported } from '@/lib/playback/gate-capability';
import { manualPlaybackProvider } from '@/lib/playback';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

describe('PRD-07: mode-switch non-destructive', () => {
  beforeEach(() => {
    queryMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
    emitSecurityAuditMock.mockReset();
  });

  it('setPlaybackMode updates mode columns only — no request DELETE/status wipe', async () => {
    clientQueryMock
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // previous mode from events FOR UPDATE
      .mockResolvedValueOnce({
        rows: [{ id: 'evt-1', playback_mode: 'spotify' }],
      })
      // event id select
      .mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] })
      // UPDATE events
      .mockResolvedValueOnce({ rows: [] })
      // UPDATE user_events
      .mockResolvedValueOnce({ rows: [] })
      // UPSERT user_settings
      .mockResolvedValueOnce({ rows: [] })
      // COMMIT
      .mockResolvedValueOnce({ rows: [] });

    const result = await setPlaybackMode('user-1', 'manual', {
      username: 'dj',
      reason: 'test',
    });

    expect(result).toEqual({
      mode: 'manual',
      previous: 'spotify',
      eventId: 'evt-1',
    });

    const sqlJoined = clientQueryMock.mock.calls
      .map((c) => String(c[0]))
      .join('\n');

    expect(sqlJoined).toMatch(/UPDATE events/i);
    expect(sqlJoined).toMatch(/playback_mode/i);
    expect(sqlJoined).not.toMatch(/DELETE\s+FROM\s+requests/i);
    expect(sqlJoined).not.toMatch(/UPDATE\s+requests/i);
    expect(sqlJoined).not.toMatch(/status\s*=\s*'pending'/i);

    expect(emitSecurityAuditMock).toHaveBeenCalledWith(
      'playback.mode_changed',
      expect.objectContaining({
        userId: 'user-1',
        meta: expect.objectContaining({ from: 'spotify', to: 'manual' }),
      })
    );
    expect(releaseMock).toHaveBeenCalled();
  });
});

describe('PRD-07: capability 501', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('refuseIfCapabilityUnsupported returns 501 CAPABILITY_NOT_SUPPORTED in manual mode', async () => {
    // getPlaybackMode → events then settings
    queryMock
      .mockResolvedValueOnce({ rows: [{ playback_mode: 'manual' }] });

    const response = await refuseIfCapabilityUnsupported(
      'user-manual',
      'playbackControls',
      'playback.previous'
    );

    expect(response).not.toBeNull();
    expect(response!.status).toBe(501);
    const body = await response!.json();
    expect(body.code).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(body.capability).toBe('playback.previous');
  });

  it('refuseIfCapabilityUnsupported allows supported Spotify playback controls', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ playback_mode: 'spotify' }],
    });

    const response = await refuseIfCapabilityUnsupported(
      'user-spotify',
      'playbackControls',
      'playback.pause'
    );
    expect(response).toBeNull();
  });

  it('manual provider queueAdd is unsupported with typed code', async () => {
    const result = await manualPlaybackProvider.addToQueue!(
      { providerId: 'manual', title: 'T', artists: 'A' },
      { userId: 'u1' }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CAPABILITY_NOT_SUPPORTED');
  });

  it('play-again and previous routes gate with refuseIfCapabilityUnsupported', () => {
    const playAgain = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/play-again/[id]/route.ts'),
      'utf8'
    );
    const previous = fs.readFileSync(
      path.join(ROOT, 'src/app/api/admin/playback/previous/route.ts'),
      'utf8'
    );
    expect(playAgain).toMatch(/refuseIfCapabilityUnsupported/);
    expect(playAgain).toMatch(/queueAdd/);
    expect(previous).toMatch(/refuseIfCapabilityUnsupported/);
    expect(previous).toMatch(/playbackControls/);
  });
});

describe('PRD-07: reorder VERSION_CONFLICT', () => {
  beforeEach(() => {
    clientQueryMock.mockReset();
    releaseMock.mockReset();
  });

  it('returns VERSION_CONFLICT when expectedVersion does not match', async () => {
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'r1',
            queue_position: 1,
            queue_version: 5,
            status: 'approved',
          },
          {
            id: 'r2',
            queue_position: 2,
            queue_version: 5,
            status: 'approved',
          },
        ],
      }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const result = await reorderAppOwnedQueue('user-1', ['r1', 'r2'], 3);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VERSION_CONFLICT');
    expect(result.message).toMatch(/concurrently/i);

    const sqlJoined = clientQueryMock.mock.calls
      .map((c) => String(c[0]))
      .join('\n');
    expect(sqlJoined).toMatch(/ROLLBACK/i);
    expect(sqlJoined).not.toMatch(/SET queue_position/i);
    expect(releaseMock).toHaveBeenCalled();
  });

  it('succeeds and bumps queue_version when expectedVersion matches', async () => {
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'r1',
            queue_position: 1,
            queue_version: 2,
            status: 'approved',
          },
          {
            id: 'r2',
            queue_position: 2,
            queue_version: 2,
            status: 'approved',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // update r2
      .mockResolvedValueOnce({ rows: [] }) // update r1
      .mockResolvedValueOnce({
        rows: [
          { id: 'r2', queue_position: 1, queue_version: 3 },
          { id: 'r1', queue_position: 2, queue_version: 3 },
        ],
      }) // select updated
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await reorderAppOwnedQueue('user-1', ['r2', 'r1'], 2);

    expect(result.ok).toBe(true);
    expect(result.queueVersion).toBe(3);
    expect(result.requests).toHaveLength(2);
  });
});
