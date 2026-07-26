/**
 * Durable seed fixture list shared by seed scripts + Superadmin user API.
 */

import {
  SEED_USERS,
  SEED_USERNAMES,
  isSeedUsername,
} from '@/lib/seed-users';

describe('seed-users', () => {
  it('lists durable fixture usernames for finalise/tests', () => {
    expect(SEED_USERNAMES).toEqual(['testuser1', 'testuser2']);
    expect(SEED_USERS.map((user) => user.username)).toEqual(SEED_USERNAMES);
  });

  it('identifies seed usernames for Superadmin list exclusion', () => {
    expect(isSeedUsername('testuser1')).toBe(true);
    expect(isSeedUsername('testuser2')).toBe(true);
    expect(isSeedUsername('real-dj')).toBe(false);
    expect(isSeedUsername('testuser')).toBe(false);
  });
});
