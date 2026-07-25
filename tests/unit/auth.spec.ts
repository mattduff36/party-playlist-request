/**
 * Authentication Unit Tests (bcrypt + jwt primitives)
 */

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

describe('Authentication Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare('wrongpassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        user_id: '11111111-1111-1111-1111-111111111111',
        username: 'testuser1',
        email: 'testuser1@example.com',
        role: 'user',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should decode a valid JWT token', () => {
      const payload = {
        user_id: '11111111-1111-1111-1111-111111111111',
        username: 'testuser1',
        email: 'testuser1@example.com',
        role: 'user',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      const decoded = jwt.verify(token, JWT_SECRET) as typeof payload;

      expect(decoded.username).toBe('testuser1');
      expect(decoded.role).toBe('user');
    });

    it('should reject tampered tokens', () => {
      const token = jwt.sign({ username: 'testuser1' }, JWT_SECRET, {
        expiresIn: '1h',
      });
      expect(() => jwt.verify(token + 'x', JWT_SECRET)).toThrow();
    });

    it('should reject expired tokens', () => {
      const token = jwt.sign({ username: 'testuser1' }, JWT_SECRET, {
        expiresIn: '-1s',
      });
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
    });
  });
});
