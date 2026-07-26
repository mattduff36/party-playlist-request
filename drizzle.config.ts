/**
 * @deprecated PRD-05 — Drizzle kit is not the canonical migrator.
 * Use `npm run db:migrate:canonical`. Config retained only for optional studio.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/_quarantine/drizzle-legacy',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
