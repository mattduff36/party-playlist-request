/**
 * Ending active events for a user must clear the admin session lock.
 */

const queryMock = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => queryMock(...args),
  }),
}));

import { endAllActiveEventsForUser } from '@/lib/event-service';

describe('endAllActiveEventsForUser', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('ends guest events and clears users.active_session_* (offline clears session)', async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'event-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // revoke display tokens
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // clear session

    const count = await endAllActiveEventsForUser('user-123');

    expect(count).toBe(1);
    expect(queryMock).toHaveBeenCalledTimes(3);

    const [endSql, endParams] = queryMock.mock.calls[0];
    expect(String(endSql)).toMatch(/UPDATE user_events/i);
    expect(endParams).toEqual(['user-123']);

    const [revokeSql] = queryMock.mock.calls[1];
    expect(String(revokeSql)).toMatch(/UPDATE display_tokens/i);

    const [clearSql, clearParams] = queryMock.mock.calls[2];
    expect(String(clearSql)).toMatch(/active_session_id\s*=\s*NULL/i);
    expect(String(clearSql)).toMatch(/active_session_created_at\s*=\s*NULL/i);
    expect(clearParams).toEqual(['user-123']);
  });

  it('still clears the admin session lock when no active guest events exist', async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const count = await endAllActiveEventsForUser('user-456');

    expect(count).toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(String(queryMock.mock.calls[1][0])).toMatch(/active_session_id/i);
  });
});
