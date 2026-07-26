/**
 * Re-export canonical seed fixtures from the shared app module.
 * Prefer importing from here in scripts/; app code should use `@/lib/seed-users`.
 */

export {
  SEED_PASSWORD,
  SEED_USERS,
  SEED_USERNAMES,
  isSeedUsername,
  type SeedUserConfig,
} from '../src/lib/seed-users';
