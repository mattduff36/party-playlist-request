/**
 * Test User Fixtures
 */

import { faker } from '@faker-js/faker';

export const TEST_USERS = {
  testuser: {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    displayName: 'Test User',
    role: 'user',
  },
  testadmin: {
    username: 'testadmin',
    email: 'admin@example.com',
    password: 'password123',
    displayName: 'Test Admin',
    role: 'user',
  },
  testdj: {
    username: 'testdj',
    email: 'dj@example.com',
    password: 'password123',
    displayName: 'Test DJ',
    role: 'user',
  },
};

export function generateTestUser() {
  return {
    username: faker.internet.userName().toLowerCase().replace(/[^a-z0-9]/g, ''),
    email: faker.internet.email(),
    password: 'testpass123',
    displayName: faker.person.fullName(),
    role: 'user',
  };
}


