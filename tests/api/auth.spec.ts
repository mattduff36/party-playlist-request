/**
 * Authentication API Tests
 */

describe('Authentication API', () => {
  const baseURL = process.env.TEST_SERVER_URL || 'http://localhost:3000';

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser1',
          password: 'testpassword123',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Handle both success and requiresTransfer responses
      if (data.requiresTransfer) {
        // If there's an existing session, we get requiresTransfer
        expect(data.requiresTransfer).toBe(true);
        expect(data.username).toBe('testuser1');
      } else {
        // Otherwise we get success
        expect(data.success).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.username).toBe('testuser1');
      }
    });

    it('should fail with invalid credentials', async () => {
      const response = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser1',
          password: 'wrongpassword',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should fail with missing credentials', async () => {
      const response = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // First login to get a token
      const loginResponse = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser1',
          password: 'testpassword123',
        }),
      });

      const cookies = loginResponse.headers.get('set-cookie');
      
      // Then logout
      const response = await fetch(`${baseURL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Cookie': cookies || '',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

