/**
 * Canonical durable seed fixtures (testuser1 / testuser2).
 * Shared by seed/cleanup scripts and Superadmin user listing.
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
    pin: '101234',
    eventTitle: 'DJ1 Test Event',
  },
  {
    username: 'testuser2',
    email: 'testuser2@example.com',
    displayName: 'Test User 2',
    pin: '202345',
    eventTitle: 'DJ2 Test Event',
  },
];

export const SEED_USERNAMES: string[] = SEED_USERS.map((user) => user.username);

export function isSeedUsername(username: string): boolean {
  return SEED_USERNAMES.includes(username);
}
