# Quality gate debt (PRD-05)

Measured on `dev/prd-05-canonical-database-ci-20260726` after clearing `@typescript-eslint/no-explicit-any` and hard-failing lint.

| Gate | Current | Target |
| --- | --- | --- |
| `npm run type-check` | **Pass (0 errors)** — CI hard-fail | Keep blocking |
| `npm run test:unit` | Pass — CI hard-fail | Keep blocking |
| `npm run build` | Pass without ignore flags | Keep blocking |
| `npm run lint` | **Pass (0 errors)** — CI hard-fail (warnings remain) | Keep blocking; drive warnings down over time |
| `next.config.ts` `typescript.ignoreBuildErrors` | **Removed** | Keep removed |
| `next.config.ts` `eslint.ignoreDuringBuilds` | **Removed** | Keep removed |

## What was reverted / not done

- **Reverted earlier:** global ESLint demotion of `@typescript-eslint/no-explicit-any` / `no-require-imports` to `warn` (conflicts with PRD-05 “do not globally suppress categories to fake green”).
- **Reverted earlier:** broad `tsconfig` excludes of `indexes.ts` / `constraints.ts`. Those foot-gun modules were **moved** to `src/lib/db/_quarantine/` instead (already excluded as quarantine).
- **Kept path-scoped:** ESLint ignore for `src/lib/db/_quarantine/**`; `scripts/**/*.{js,cjs}` may use `require` (legacy CJS ops scripts only).

## Remaining non-blocking debt

- Lint **warnings** (unused vars, react-hooks deps, etc.) — not failing CI.
- A few unavoidable open JSON boundaries use scoped `eslint-disable-next-line @typescript-eslint/no-explicit-any` (e.g. Spotify REST client return, drizzle row helpers) with one-line reasons — not a global rule demotion.

## Do not

- Globally demote TypeScript/ESLint categories to warn/off to fake green.
- Re-introduce `typescript.ignoreBuildErrors` or `eslint.ignoreDuringBuilds`.
- Re-introduce request-time DDL to paper over missing migrations.
