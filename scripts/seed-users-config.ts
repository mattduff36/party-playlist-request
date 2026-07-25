/**
 * Canonical seeded test accounts shared by seed + cleanup.
 * Keep usernames/emails aligned with tests/fixtures/users.ts.
 */

export interface SeedUserConfig {
  username: string;
  email: string;
  displayName: string;
  pin: string;
  eventTitle: string;
}

export const SEED_PASSWORD = 'testpassword123';

export const SEED_USERS: SeedUserConfig[] = [
  {
    username: 'testuser1',
    email: 'testuser1@example.com',
    displayName: 'Test User 1',
    pin: '1111',
    eventTitle: 'DJ1 Test Event',
  },
  {
    username: 'testuser2',
    email: 'testuser2@example.com',
    displayName: 'Test User 2',
    pin: '2222',
    eventTitle: 'DJ2 Test Event',
  },
];

export const SEED_USERNAMES = SEED_USERS.map((user) => user.username);
