/**
 * Canonical test users — aligned with scripts/seed-test-data.ts
 */

import { faker } from '@faker-js/faker';

export const TEST_PASSWORD = 'testpassword123';

export const TEST_USERS = {
  testuser1: {
    username: 'testuser1',
    email: 'testuser1@example.com',
    password: TEST_PASSWORD,
    displayName: 'Test User 1',
    pin: '1111',
    eventTitle: 'DJ1 Test Event',
    role: 'user' as const,
  },
  testuser2: {
    username: 'testuser2',
    email: 'testuser2@example.com',
    password: TEST_PASSWORD,
    displayName: 'Test User 2',
    pin: '2222',
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
  return {
    username: faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''),
    email: faker.internet.email(),
    password: TEST_PASSWORD,
    displayName: faker.person.fullName(),
    role: 'user' as const,
  };
}
