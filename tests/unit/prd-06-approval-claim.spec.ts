/**
 * PRD-06: stuck approving reclaim + release on failure paths.
 */

const queryMock = jest.fn();

jest.mock('@/lib/db', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => queryMock(...args),
  }),
}));

import {
  APPROVAL_CLAIM_TIMEOUT_MS,
  claimRequestForApproval,
  releaseApprovalClaim,
} from '@/lib/reliability/claim-approval';

describe('PRD-06: approval claim recovery', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('claim SQL reclaims stuck approving after timeout and sets claim_started_at', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'req-1', status: 'approving' }],
    });

    const row = await claimRequestForApproval('req-1', 'user-1', {
      timeoutMs: 60_000,
    });

    expect(row?.id).toBe('req-1');
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toMatch(/claim_started_at = NOW\(\)/);
    expect(String(sql)).toMatch(/status = 'approving'/);
    expect(String(sql)).toMatch(/claim_started_at < NOW\(\)/);
    expect(String(sql)).toMatch(/status IN \('pending', 'rejected', 'queue_failed', 'failed'\)/);
    expect(params).toEqual(['req-1', 'user-1', 60_000]);
    expect(APPROVAL_CLAIM_TIMEOUT_MS).toBe(120_000);
  });

  it('releaseApprovalClaim reverts approving to queue_failed', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-1' }] });

    const released = await releaseApprovalClaim(
      'req-1',
      'user-1',
      'queue_failed'
    );

    expect(released).toBe(true);
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toMatch(/SET status = \$3/);
    expect(String(sql)).toMatch(/claim_started_at = NULL/);
    expect(String(sql)).toMatch(/AND status = 'approving'/);
    expect(params).toEqual(['req-1', 'user-1', 'queue_failed']);
  });

  it('releaseApprovalClaim can revert to pending', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'req-2' }] });
    const released = await releaseApprovalClaim('req-2', 'user-2', 'pending');
    expect(released).toBe(true);
    expect(queryMock.mock.calls[0][1]).toEqual(['req-2', 'user-2', 'pending']);
  });

  it('releaseApprovalClaim returns false when row was not approving', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const released = await releaseApprovalClaim('req-3', 'user-3');
    expect(released).toBe(false);
  });
});
