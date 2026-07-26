/**
 * Single-admin-session lock decision helpers
 */

import {
  ADMIN_SESSION_TTL_MS,
  decideAdminSessionLogin,
  isAdminSessionExpired,
  isLikelyDifferentClient,
} from '@/lib/admin-session';

describe('admin-session', () => {
  const nowMs = Date.parse('2026-07-26T12:00:00.000Z');
  const recentCreatedAt = new Date(nowMs - 60 * 60 * 1000).toISOString(); // 1h ago
  const expiredCreatedAt = new Date(
    nowMs - ADMIN_SESSION_TTL_MS - 1000
  ).toISOString();

  describe('isAdminSessionExpired', () => {
    it('treats locks older than 24h TTL as expired', () => {
      expect(isAdminSessionExpired(expiredCreatedAt, nowMs)).toBe(true);
      expect(isAdminSessionExpired(recentCreatedAt, nowMs)).toBe(false);
    });

    it('treats missing/invalid timestamps as expired', () => {
      expect(isAdminSessionExpired(null, nowMs)).toBe(true);
      expect(isAdminSessionExpired('not-a-date', nowMs)).toBe(true);
    });
  });

  describe('isLikelyDifferentClient', () => {
    it('is true only when cookie session_id exists and differs', () => {
      expect(isLikelyDifferentClient('aaa', 'bbb')).toBe(true);
      expect(isLikelyDifferentClient('aaa', 'aaa')).toBe(false);
      expect(isLikelyDifferentClient(null, 'bbb')).toBe(false);
      expect(isLikelyDifferentClient(undefined, 'bbb')).toBe(false);
    });
  });

  describe('decideAdminSessionLogin', () => {
    it('skips modal for superadmin', () => {
      expect(
        decideAdminSessionLogin({
          role: 'superadmin',
          lock: {
            activeSessionId: 'sess-1',
            activeSessionCreatedAt: recentCreatedAt,
          },
          nowMs,
        })
      ).toEqual({ action: 'proceed_new' });
    });

    it('clears expired lock without modal (TTL skips modal)', () => {
      expect(
        decideAdminSessionLogin({
          role: 'user',
          lock: {
            activeSessionId: 'sess-old',
            activeSessionCreatedAt: expiredCreatedAt,
          },
          cookieSessionId: null,
          nowMs,
        })
      ).toEqual({ action: 'clear_expired_then_proceed' });
    });

    it('resumes when cookie session_id matches DB lock', () => {
      expect(
        decideAdminSessionLogin({
          role: 'user',
          lock: {
            activeSessionId: 'sess-same',
            activeSessionCreatedAt: recentCreatedAt,
          },
          cookieSessionId: 'sess-same',
          nowMs,
        })
      ).toEqual({ action: 'resume_same', sessionId: 'sess-same' });
    });

    it('requires transfer with stale/previous-session copy when no cookie evidence', () => {
      expect(
        decideAdminSessionLogin({
          role: 'user',
          lock: {
            activeSessionId: 'sess-prev',
            activeSessionCreatedAt: recentCreatedAt,
          },
          cookieSessionId: null,
          nowMs,
        })
      ).toEqual({
        action: 'require_transfer',
        sessionId: 'sess-prev',
        createdAt: recentCreatedAt,
        likelyDifferentClient: false,
      });
    });

    it('requires transfer with different-client flag when cookie session differs', () => {
      expect(
        decideAdminSessionLogin({
          role: 'user',
          lock: {
            activeSessionId: 'sess-db',
            activeSessionCreatedAt: recentCreatedAt,
          },
          cookieSessionId: 'sess-other',
          nowMs,
        })
      ).toEqual({
        action: 'require_transfer',
        sessionId: 'sess-db',
        createdAt: recentCreatedAt,
        likelyDifferentClient: true,
      });
    });

    it('proceeds when no lock is present', () => {
      expect(
        decideAdminSessionLogin({
          role: 'user',
          lock: { activeSessionId: null, activeSessionCreatedAt: null },
          nowMs,
        })
      ).toEqual({ action: 'proceed_new' });
    });
  });
});
