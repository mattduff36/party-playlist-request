/**
 * Transfer client must send oldSessionId from sessionInfo.sessionId
 */

import { buildSessionTransferRequestBody } from '@/lib/admin-session';

describe('transfer session client payload', () => {
  it('passes oldSessionId from sessionInfo.sessionId when transferring', () => {
    const sessionInfo = {
      sessionId: 'lock-session-abc',
      created_at: '2026-07-26T00:00:00.000Z',
    };

    const body = buildSessionTransferRequestBody({
      username: 'mattduff36',
      password: 'secret',
      oldSessionId: sessionInfo.sessionId,
    });

    expect(body).toEqual({
      username: 'mattduff36',
      password: 'secret',
      oldSessionId: 'lock-session-abc',
    });
  });
});
