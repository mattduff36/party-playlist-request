/**
 * Unit tests for @/lib/auth helpers
 */

import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
} from '@/lib/auth';

describe('@/lib/auth', () => {
  const prevSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit_test_jwt_secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = prevSecret;
  });

  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('testpassword123');
    expect(hash).not.toBe('testpassword123');
    expect(await comparePassword('testpassword123', hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });

  it('generates and verifies JWT payloads', () => {
    const token = generateToken({
      user_id: '11111111-1111-1111-1111-111111111111',
      username: 'testuser1',
      email: 'testuser1@example.com',
      role: 'user',
    });
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.username).toBe('testuser1');
    expect(payload?.role).toBe('user');
    // Legacy-style mint without session_id must not crash parsers
    expect(payload?.session_id).toBeUndefined();
  });

  it('includes optional session_id in JWT when provided', () => {
    const token = generateToken({
      user_id: '11111111-1111-1111-1111-111111111111',
      username: 'testuser1',
      email: 'testuser1@example.com',
      role: 'user',
      session_id: 'sess-abc-123',
    });
    const payload = verifyToken(token);
    expect(payload?.session_id).toBe('sess-abc-123');
  });

  it('rejects invalid tokens', () => {
    expect(verifyToken('not.a.jwt')).toBeNull();
  });
});
