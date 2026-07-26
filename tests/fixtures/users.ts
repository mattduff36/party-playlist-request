/**
 * Canonical test users — aligned with src/lib/seed-users.ts (via scripts/seed-users-config).
 */

import { faker } from '@faker-js/faker';

export const TEST_PASSWORD = 'testpassword123';

export const TEST_USERS = {
  testuser1: {
    username: 'testuser1',
    email: 'testuser1@example.com',
    password: TEST_PASSWORD,
    displayName: 'Test User 1',
    pin: '101234',
    eventTitle: 'DJ1 Test Event',
    role: 'user' as const,
  },
  testuser2: {
    username: 'testuser2',
    email: 'testuser2@example.com',
    password: TEST_PASSWORD,
    displayName: 'Test User 2',
    pin: '202345',
    eventTitle: 'DJ2 Test Event',
    role: 'user' as const,
  },
  /** @deprecated use testuser1 — kept for older references */
  testuser: {
    username: 'testuser1',
    email: 'testuser1@example.com',
    password: TEST_PASSWORD,
    displayName: 'Test User 1',
    role: 'user' as const,
  },
};

export function generateTestUser() {
  const suffix = `${Date.now().toString(36)}${faker.string.alphanumeric(4)}`.toLowerCase();
  const username = `test_${suffix}`.slice(0, 24);
  return {
    username,
    email: `${username}@example.com`,
    password: TEST_PASSWORD,
    displayName: faker.person.fullName(),
    role: 'user' as const,
  };
}
